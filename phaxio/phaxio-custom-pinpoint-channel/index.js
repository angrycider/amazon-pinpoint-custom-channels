// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
const S3 = new AWS.S3({region:process.env.AWS_REGION})
var PDFDocument = require('pdfkit');

// Create an SQS service object
var sqs = new AWS.SQS({apiVersion: '2012-11-05'});

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function sendToS3 (applicationId, campaignId, endpointId, endpoint) {
    console.log('sendToS3');
    var doc = new PDFDocument();

    doc.text(`Hello World! - Pinpoint Phaxio Custom Channel`,);
    doc.moveDown();
    doc.text(`applicationId: ${applicationId}`);
    doc.moveDown();
    doc.text(`campaignId: ${campaignId}`);
    doc.moveDown();
    doc.text(`endpointId: ${endpointId}`);
    doc.rect(doc.x, 0, 200, doc.y).stroke();
    doc.end();

    var params = {
        Key : `${applicationId}/${campaignId}/${endpointId}`,
        Body : doc,
        Bucket : process.env.S3_BUCKET,
        ContentType : 'application/pdf'
    }

    try {
            let results = await S3.upload(params).promise();
            console.log('sendToS3 Success...');
            return `${applicationId}/${campaignId}/${endpointId}`;
        } catch (err) {
            console.log('sendToS3 Error...');
            console.error(err)
        }
}

async function sendMessage (applicationId, campaignId, endpointId, endpoint) {
    console.log('sendMessage');
    // The endpoint profile contains the entire endpoint definition.
    // Attributes and UserAttributes can be interpolated into your message for personalization.
    // You can use this information to save a file to S3 and populate the S3Path
    // and/or specify a URL to a file.
    // If you specify both parameters, Phaxio will combine in one fax transmission.
    // The code below will also attempt to pull a FaxNumber from the attributes, and if not specified
    // will fall back to using the endpoint Address if not specified.  However endpoint addresses need to be
    // unique, and I suspect this fax channel may require routing many different endpoints to a single fax number
    // so I've set it up to allow for having multiple endpoints with a FaxNumber attribute to a single line.

    let s3Key = await sendToS3(applicationId, campaignId, endpointId, endpoint);

    var msg = {
        applicationId: applicationId,
        campaignId: campaignId,
        endpointId: endpointId,
        faxS3Key: s3Key,
        faxS3Bucket: process.env.S3_BUCKET,
        faxURL: null,
        faxNumber: endpoint.Attributes.FaxNumber || endpoint.Address
    }

    var params = {
        MessageBody: JSON.stringify(msg),
        MessageDeduplicationId: `${applicationId}-${campaignId}-${endpointId}`,
        MessageGroupId: `${applicationId}-${campaignId}`,
        QueueUrl: process.env.PHAXIO_SQS_QUEUE_URL
    };

    try {
        let results = await sqs.sendMessage(params).promise();
        console.log('sendMessage Success...');
        return `${results.MessageId}`;
      } catch (err) {
        console.log('sendMessage Error...');
        console.error(err)
      }
}


exports.handler = async (event) => {
    console.log(JSON.stringify(event, null, 2));

    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    
    var endpoints = []
    for (const [key, value] of Object.entries(event.Endpoints)) {
        value.endpointId = key;
        endpoints.push(value);
    }

    for(var i=0;i<endpoints.length;i++){
        try{
            await sendMessage(event.ApplicationId, event.CampaignId, endpoints[i].endpointId, endpoints[i]);
        }
        catch(ex){
            console.log(ex);
        }
    }
    return response;
};
