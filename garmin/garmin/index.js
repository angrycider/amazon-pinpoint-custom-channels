let response;
const axios = require('axios');
const moment = require('moment');
const AWS = require('aws-sdk');
const pinpoint = new AWS.Pinpoint();


function processEndpoints (campaignID, endpoints, pinpointEvents) {
  return new Promise((resolve, reject) => {
    try {
      let axiosArray = [];
      Object.keys(endpoints).forEach(function (endpointID) {
        var endpoint = endpoints[endpointID];

        let postData = 	{
          "Messages":[{
            "Message":"",
            "Recipients":[],
            "Sender":"dave@davelemons.com",
            "Timestamp":`/Date(${moment().valueOf()})/`
        }]};

        //TODO: Can make this much smarter to batch messages to API, but for POC, this is good
        postData.Messages[0].Message = `New Message for: ${endpointID}`;
        postData.Messages[0].Recipients.push = endpoint.Address;
        let newPromise = axios({
            method: 'post',
            url: process.env.GARMINWEBHOOKURL,
            auth: {
              username: process.env.GARMINWEBHOOKUSER,
              password: process.env.GARMINWEBHOOKPASS //TODO: This should be in a secret
            },
            data: postData
          });
        axiosArray.push(newPromise);
      });
        
      axios.all(axiosArray)
      .then(axios.spread((...responses) => {
        responses.forEach(res => {
          //var returnedEndpointID = JSON.parse(res.config.data).value2;
          if (res.status === 200){
            console.log('Success');
            //pinpointEvents[returnedEndpointID] = createPinpointSuccess(returnedEndpointID, campaignID);
          } else {
            console.log('Error');
            //pinpointEvents[returnedEndpointID] = createPinpointError(returnedEndpointID, campaignID, res.status, res.statusText);
          }
        });
        console.log('submitted all axios calls');
        resolve();
      }))
      .catch(err => {
        console.error(err);
        reject(err);
      });
    } catch (ex) {
      reject(ex);
    }
  });
}

function createPinpointSuccess (endpointID, campaignID) {
  var customEvent = {
    Endpoint: {},
    Events: {}
  };

  customEvent.Events[`garmin_${endpointID}_${campaignID}`] = {
    EventType: 'garmin.success',
    Timestamp: moment().toISOString(),
    Attributes: {
      endpointID: endpointID
    }
  };
  return customEvent;
}
function createPinpointError (endpointID, campaignID, status, err) {
  var customEvent = {
    Endpoint: {},
    Events: {}
  };

  customEvent.Events[`garmin_${endpointID}_${campaignID}`] = {
    EventType: 'garmin.error',
    Timestamp: moment().toISOString(),
    Attributes: {
      endpointID: endpointID,
      status: status,
      err: JSON.stringify(err)
    }
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

    pinpoint.putEvents(params, function (err) {
      if (err) {
        console.log(err, err.stack);
        resolve(); // Just going to log and return;
      } else {
        resolve();
      }
    });
  });
}

function sendGARMINEvents (event) {
  return new Promise((resolve, reject) => {
    try {
      if (event.Endpoints.length === 0) {
        resolve({ message: 'no endpoints to process' });
      }

        var campaignID = event.CampaignId;
        var pinpointEvents = {};

        processEndpoints(campaignID, event.Endpoints, pinpointEvents)
          // .then(function () {
          //   return processEvents(event.ApplicationId, pinpointEvents);
          // })
          .then(function () {
            resolve({ message: 'success' });
          })
          .catch(function (err) {
            console.error(`unhandled exception updating garmin: ${JSON.stringify(err)}`);
            reject({ message: `unhandled exception: ${err}` });
          });
    } catch (err) {
      console.error(`unknown error: ${JSON.stringify(err)}`);
      reject({ message: `unknown error: ${JSON.stringify(err)}` });
    }
  });
}

exports.handler = async (event, context) => {
  console.log(JSON.stringify(event, null, 2));
  var body = await sendGARMINEvents(event);

  response = {
    statusCode: 200,
    body: JSON.stringify(body)
  };

  return response;
};
