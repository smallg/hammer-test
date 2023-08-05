import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { nanoid } from 'nanoid';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event, context, callback) => {
  console.log('----api-gateway-params-----', event)
  const command = new PutCommand({
    TableName: "FileTable",
    Item: {
      id: nanoid(),
      userText: event.comment,
      filepath: `hammer-wp/${event.filename}`
    },
  });

  await docClient.send(command);

  const response = {
    statusCode: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Credentials": true,
    },
    body: JSON.stringify({ message: "OK", status: 200 }),
  };
  callback(null, response);
};
