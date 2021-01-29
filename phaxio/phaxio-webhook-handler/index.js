const AWS = require('aws-sdk');
const pinpoint = new AWS.Pinpoint();
const crypto = require('crypto');
const fs = require('fs');
const moment = require('moment');
const multipart = require('aws-lambda-multipart-parser');

function generateSignature(url, req, callbackToken) {
    //sort the POST fields first and add them to the url
    var names = [];
    for (var idx in req.body) names.push(idx);
    names.sort();

    for (var idx = 0; idx < names.length; idx++) {
        url += names[idx] + req.body[names[idx]];
    }

    //sort the file parts and add their SHA1 sums to the URL
    var fileNames = [];
    var fieldNamePaths = {};
    for (var idx in req.files){
        var fieldname = req.files[idx].fieldname;
        fileNames.push(fieldname);
        fieldNamePaths[fieldname] = req.files[idx].path;
    }
    fileNames.sort();

    for (var idx = 0; idx < fileNames.length; idx++) {
        var fileSha1Hash = crypto.createHash('sha1').update(fs.readFileSync(fieldNamePaths[fileNames[idx]])).digest('hex');
        url += fileNames[idx] + fileSha1Hash;
    }

    return crypto.createHmac('sha1', callbackToken).update(url).digest('hex');
}

function createPinpointEvent (phaxioEvent, action) {
  var customEvent = {
    Endpoint: {},
    Events: {}
  };
  
//TODO...need to find way to log recipients
//   var recipients = [];

//   if (phaxioEvent.recipients && phaxioEvent.recipients.length){
//       phaxioEvent.recipients.forEach(element => { 
//         recipients.push(element.phone_number); 
//     });
//     phaxioEvent.recipients = recipients;
//   }
  
  //Gotta do some cleanup
  phaxioEvent.id = phaxioEvent.id + "";
  phaxioEvent['num_pages'] = phaxioEvent['num_pages'] + ""; //TODO...add to Metric
  phaxioEvent['is_test'] = phaxioEvent['is_test'] + "";
  phaxioEvent['cost'] = phaxioEvent['cost'] + ""; //TODO...add to Metric
  delete phaxioEvent.recipients;
  delete phaxioEvent.barcodes;
  
  var endpointId = phaxioEvent.tags.endpointId;
  var campaignId = phaxioEvent.tags.campaignId;
  
  delete phaxioEvent.tags;

  customEvent.Events[`phaxio_${endpointId}_${campaignId}`] = {
    EventType: action,
    Timestamp: moment().toISOString(),
    Attributes: phaxioEvent
  };
  return customEvent;
}

function processEvents (applicationId, events) {
  return new Promise((resolve) => {
    var params = {
      ApplicationId: applicationId,
      EventsRequest: {
        BatchItem: events
      }
    };
    
    console.log("Params:", params);

    try {
        pinpoint.putEvents(params, function (err) {
          if (err) {
            console.log(err, err.stack);
            resolve(); // Just going to log and return
          } else {
            console.log("Put Events Success!");
            resolve();
          }
        });
    }
    catch(ex){
        console.log(ex, ex.stack);
        resolve(); // Just going to log and return
    }
  });
}

//Sample Event
// {
// 	"id": 242848324,
// 	"direction": "sent",
// 	"num_pages": 1,
// 	"status": "success",
// 	"is_test": true,
// 	"created_at": "2021-01-15T18:23:40.000Z",
// 	"caller_id": null,
// 	"from_number": null,
// 	"completed_at": "2021-01-15T18:23:42.000Z",
// 	"caller_name": null,
// 	"cost": 7,
// 	"tags": {},
// 	"recipients": [{
// 		"phone_number": "+13173739253",
// 		"status": "success",
// 		"retry_count": 0,
// 		"completed_at": "2021-01-15T18:23:42.000Z",
// 		"bitrate": 14400,
// 		"resolution": 7700,
// 		"error_type": null,
// 		"error_id": null,
// 		"error_message": null
// 	}],
// 	"to_number": null,
// 	"error_id": null,
// 	"error_type": null,
// 	"error_message": null,
// 	"barcodes": []
// }

/**
 * Logs Phaxio Webhook events as Pinpoint Events
 */
exports.handler = async (event, context) => {
    console.log('Received event:', JSON.stringify(event, null, 2));
    
    let body;
    let statusCode = '200';
    const headers = {
        'Content-Type': 'application/json',
    };

    try {
        
        //Validate Signature from Phaxio
        const url = `https://${event.requestContext.domainName}${event.requestContext.path}`;
        const result = multipart.parse(event, true);
        var sig = generateSignature(url, {body:result}, process.env.WEBHOOK_TOKEN);
        
        var pinpointEvents = {};
        
        if (event.headers['X-Phaxio-Signature'] && event.headers['X-Phaxio-Signature'] === sig) {
            //We have a good signature
            console.log("Good Signature");
            switch (event.httpMethod) {
                case 'POST':
                    var eventType = result['event_type'];
                    var phaxioEvent = JSON.parse(result.fax);
                    var endpointId = phaxioEvent.tags.endpointId;
                    var applicationId = phaxioEvent.tags.applicationId;
                    
                    pinpointEvents[endpointId] = createPinpointEvent(phaxioEvent, eventType);
                    
                    await processEvents(applicationId, pinpointEvents);
                    
                    return {
                            statusCode,
                            body,
                            headers,
                    };
                default:
                    throw new Error(`Unsupported method "${event.httpMethod}"`);
            }
        } else {
            statusCode = '401';
            return {
                statusCode,
                body,
                headers,
            };
        }
    } catch (err) {
        statusCode = '400';
        body = err.message;
        return {
            statusCode,
            body,
            headers,
        };
    } 

};
