import {
  RunInstancesCommand,
  StopInstancesCommand,
  EC2Client,
  DescribeInstanceStatusCommand,
} from '@aws-sdk/client-ec2';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { SSMClient, SendCommandCommand } from '@aws-sdk/client-ssm';
const REGION = 'us-east-1';
const client = new EC2Client({ region: REGION });
const ssmClient = new SSMClient({ region: REGION });
const lambdaClient = new LambdaClient({ region: REGION });
const delayTime = 10 * 1000;

export const handler = async (event) => {
  console.log(JSON.stringify(event, null, 2));
  const record = event.Records[0];
  const db = record.dynamodb;
  const filepath = db.NewImage.filepath.S;
  const bucketName = filepath.split('/')[0];
  const filename = filepath.split('/')[1];
  const comment = db.NewImage.userText.S;
  console.log(record.eventID);
  console.log(record.eventName);
  const eventName = event.Records[0].eventName;
  if (!event.invoke && !event.instanceId && eventName === 'INSERT') {
    const instances = await createAndRunEC2();
    console.log('-----instances----', JSON.stringify(instances));
    const instanceId = instances.Instances[0].InstanceId;
    console.log('-----instanceId-----', instanceId);
    await checkAndRunCommand(event, instanceId, {
      filepath,
      filename,
      comment,
      bucketName,
    });
  }

  if (event.invoke && event.instanceId) {
    console.log('-----invoke-----', event.instanceId);
    await checkAndRunCommand(event, event.instanceId, {
      filepath,
      filename,
      comment,
      bucketName,
    });
  }
};

const checkAndRunCommand = async (event, instanceId, fileInfo) => {
  const checkInput = { instanceIds: [instanceId] };
  const command = new DescribeInstanceStatusCommand(checkInput);
  const checkRes = await client.send(command);
  console.log('-----checkRes----', checkRes);
  const instanceStatus =
    (checkRes.InstanceStatuses[0] &&
      checkRes.InstanceStatuses[0].InstanceState.Name) ||
    'unknown';
  console.log('---------instanceStatus----', instanceStatus);
  if (instanceStatus !== 'running') {
    await delay(delayTime);
    await invoke(event, instanceId);
  } else {
    await delay(delayTime);
    await ssmToEC2Instance(instanceId, fileInfo);
    // Close EC2 instance
    await closeInstance(instanceId);
  }
};

const invoke = async (event, instanceId) => {
  event.invoke = true;
  event.instanceId = instanceId;
  const invokeInput = {
    FunctionName: 'DynamoDB-watch',
    InvocationType: 'Event',
    Payload: JSON.stringify(event),
  };
  const invokeCommand = new InvokeCommand(invokeInput);
  await lambdaClient.send(invokeCommand);
};

const ssmToEC2Instance = async (instanceId, fileInfo) => {
  const { filepath, filename, comment, bucketName } = fileInfo;
  console.log('-----------file info-----------', fileInfo);
  const outputFilename = `output-${filename}`;
  const execInput = {
    InstanceIds: [instanceId],
    DocumentName: 'AWS-RunShellScript',
    Parameters: {
      commands: [
        `aws s3 cp s3://${filepath} .`,
        `echo ${comment} >> ${filename}`,
        `mv ${filename} ${outputFilename}`,
        `aws s3 cp ${outputFilename} s3://${bucketName}`,
      ],
    },
  };
  const execCommand = new SendCommandCommand(execInput);
  const response = await ssmClient.send(execCommand);
  console.log('----success-----', response);
};

const createAndRunEC2 = async () => {
  const command = new RunInstancesCommand({
    SecurityGroupIds: ['sg-05be3a338916eabb6'],
    ImageId: 'ami-0f34c5ae932e6f0e4',
    InstanceType: 't2.micro',
    MinCount: 1,
    MaxCount: 1,
    IamInstanceProfile: {
      Arn: 'arn:aws:iam::993553184910:instance-profile/ec2_s3',
    },
  });

  try {
    const response = await client.send(command);
    console.log('-----success create/run ec2 instance------', response);
    return response;
  } catch (err) {
    console.error(err);
  }
};

const closeInstance = async (instanceId) => {
  const command = new StopInstancesCommand({
    InstanceIds: [instanceId],
  });

  try {
    const { StoppingInstances } = await client.send(command);
    const instanceIdList = StoppingInstances.map(
      (instance) => `${instance.InstanceId}`
    );
    console.log('Stopping instances:');
    console.log(instanceIdList.join('\n'));
  } catch (err) {
    console.error(err);
  }
};

const delay = (t, v) => {
  return new Promise(function (resolve) {
    setTimeout(resolve.bind(null, v), t);
  });
};
