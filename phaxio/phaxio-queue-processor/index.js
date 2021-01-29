const AWS = require("aws-sdk");
const S3 = new AWS.S3({region:process.env.AWS_REGION})
const Phaxio = require('phaxio-official');
const fse = require('fs-extra');
const phaxio = new Phaxio(process.env.PHAXIOKEY, process.env.PHAXIOSECRET);

async function getFromS3 (bucket, key) {
  console.log('getFromS3');

  var params = {
      Key : key,
      Bucket : bucket
  }

  console.log(params)
  try {
    console.log(1);
    const { Body } = await S3.getObject(params).promise();
    console.log(2);
    fse.outputFileSync(`/tmp/${key}`, Body);
    console.log('getFromS3 Success...');
    return `/tmp/${key}`;
  } catch (err) {
      console.log('getFromS3 Error...');
      console.error(err)
  }
}

async function sendFax(msg){
  console.log('sendFax');
  console.log(msg);
  try {
    var params = {
      to: msg.faxNumber, // Replace this with a number that can receive faxes.
      tags: {
          applicationId: msg.applicationId,
          campaignId: msg.campaignId,
          endpointId: msg.endpointId
        }
    }

    if (msg.faxURL) params.content_url = msg.faxURL;

    if (msg.faxS3Key){
      //need to pull down from S3...I couldn't find a way to stream from S3
      let tmpFilePath = await getFromS3(msg.faxS3Bucket, msg.faxS3Key)
      console.log(tmpFilePath)
      params.file = tmpFilePath
    }

    let results = await phaxio.faxes.create(params)
    console.log('sendFax Success...');
    return results;
  } catch (err) {
      console.log('sendFax Error...');
      console.error(err)
  }

  // phaxio.faxes.create({
  //   to: '+13173739253', // Replace this with a number that can receive faxes.
  //   file: `${__dirname}/TestFaxFromS3.pdf`,
  //   tags: {
  //       applicationId: "1aa20d5ade5c4699a5df45ddad370a10",
  //       campaignId: "testcampaignid",
  //       endpointId: "testendpointid"
  //     }
  //   })
  //   .then((fax) => {
  //     console.log(fax);
  //     // {
  //     //   apiKey: 'yadayada',
  //     //   apiSecret: 'yadayada',
  //     //   url: 'https://api.phaxio.com/v2.1',
  //     //   success: true,
  //     //   message: 'Fax queued for sending',
  //     //   id: 242848324,
  //     //   agentOptions: undefined,
  //     //   auth: {
  //     //     user: 'yadayada',
  //     //     pass: 'yadayada'
  //     //   }
  //     // }
  //   })
  //   .catch((err) => { throw err; });
}

exports.handler = async (event) => {
  //console.log('Received event:', JSON.stringify(event, null, 2));
  try{
    for (const { messageId, body } of event.Records) {
      console.log('SQS message %s: %j', messageId, body);
      var msg = JSON.parse(body);
      await sendFax(msg);
    }
    return `Successfully processed ${event.Records.length} messages.`;
  }
  catch(ex){
    console.log(ex)
    return 'Error'
  }

};


    
