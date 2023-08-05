var AWS = require('aws-sdk');
var lambda = new AWS.Lambda({region: 'us-west-2'});  // Change the region as per your needs
var ec2 = new AWS.EC2({region: 'us-west-2'});  // Change the region as per your needs

function delay(t, v) {
   return new Promise(function(resolve) { 
       setTimeout(resolve.bind(null, v), t)
   });
}

exports.handler = async (event) => {
    if (!event.instanceId) {
        // Creating EC2 instance if instanceId is not provided in the event object
        var params = {
            ImageId: '<ami-id>', // Replace with your AMI ID
            InstanceType: 't2.micro', // Or any other type
            MinCount: 1,
            MaxCount: 1,
            KeyName: '<key-pair-name>' // Replace with your key pair name
        };
        
        var data = await ec2.runInstances(params).promise();
        event.instanceId = data.Instances[0].InstanceId;
        console.log("Created instance", event.instanceId);
    }
    
    // Checking instance status
    var params = {
        InstanceIds: [event.instanceId]
    };
    
    var data = await ec2.describeInstances(params).promise();
    var instanceStatus = data.Reservations[0].Instances[0].State.Name;
    console.log("Instance status: ", instanceStatus);
    
    // If instance is not running, call the Lambda function again
    if (instanceStatus !== 'running') {
        event.attempts = (event.attempts || 0) + 1;
        if (event.attempts < 5) {  // Max 5 attempts
            await delay(10000);  // Wait for 10 seconds
            var params = {
                FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME,  // Function name
                InvocationType: 'Event',  // Async invocation
                Payload: JSON.stringify(event)
            };
            await lambda.invoke(params).promise();
        } else {
            console.log("Max attempts reached. Stopping recursion.");
        }
    }
};