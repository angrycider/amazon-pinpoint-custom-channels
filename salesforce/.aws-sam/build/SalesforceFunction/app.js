let response;
let jsforce = require('jsforce');
let axios = require('axios');
let moment = require('moment');
let jwt = require('jsonwebtoken');
let url = require('url');
let querystring = require('querystring');


function generateSFJWT(){
    var consumerKey = process.env.SFCONSUMERKEY; 
    var awsApiUser = process.env.SFAPIUSERNAME; 
    var sandbox = (process.env.SANDBOX == 'true');  
    var instanceUrl = process.env.SFLOGINURL;

    //Rebuild cert from environment variable.
    var beginPk = "-----BEGIN PRIVATE KEY-----\n";
    var endPk   = "\n-----END PRIVATE KEY-----\n";
    var privateKey = beginPk + process.env.SFPRIVATEKEY.split(' ').concat().join('\n') + endPk;

    //Build JWT
    var jwtparams = {
        iss: consumerKey,
        prn: awsApiUser,
        aud: instanceUrl,
        exp: parseInt(moment().add(2, 'minutes').format('X'))
    };

    var token = jwt.sign(jwtparams, privateKey, { algorithm: 'RS256' });

    return token;
}

function buildSFObjectFromEndpoint(endpoint){
    //Customize this method as needed to update the SF object based on your enpoint Attributes.
    //The following are the bare minimum fields for a Lead Object
    console.info(JSON.stringify(endpoint))
    return {
        FirstName:endpoint.Attributes.FirstName[0],
        LastName:endpoint.Attributes.LastName[0],
        Company:endpoint.Attributes.Company[0] 
    };
}

function processInserts(conn, sfObject, endpoints, pinpointEvents){
    return new Promise((resolve) => {
        var endpointsToInsert = [];
        var events = {};
        var updateAttribute = process.env.UPDATEATTRIBUTE;

        Object.keys(endpoints).forEach(function (endpointID) {
            var endpoint = endpoints[endpointID]

            if (updateAttribute){
                if (!endpoint.Attributes[updateAttribute][0]) {
                    //endpoint has an update field, but it's empty, so perform an insert.
                    endpointsToInsert.push(buildSFObjectFromEndpoint(endpoint));
                }
            } else {
                //custom channel not configured to do updates, so insert
                endpointsToInsert.push(buildSFObjectFromEndpoint(endpoint));
            }
        })
        

        if(endpointsToInsert.length === 1){
            //Just a single record to insert, so make single API call
            console.log("Found Single Object to Insert:");
            console.log(JSON.stringify(endpointsToInsert[0]));

            conn.sobject(sfObject).create(endpointsToInsert[0], function(err, ret) {
                console.log("Single Insert");
                if (err || !ret.success) { 
                    console.error(err, ret); 
                } else {
                    console.log("Created record id : " + ret.id);
                }
                resolve(events)
            });
        } else if (endpointsToInsert.length > 1){
            //Multiple records to insert, so make use of bulk api to optimize API call limits.
            
            console.log("Found Multiple Objects to Insert");
            console.log(JSON.stringify(endpointsToInsert));

            conn.bulk.load(sfObject, "insert", endpointsToInsert, function(err, rets) {
                console.log("BULKLoad--Insert");
                if (err) { 
                     console.error(err); 
                } else {
                    for (var i=0; i < rets.length; i++) {
                        if (rets[i].success) {
                            console.log("#" + (i+1) + " inserted successfully, id = " + rets[i].id);
                        } else {
                            console.log("#" + (i+1) + " insert error occurred, message = " + rets[i].errors.join(', '));
                        }
                    }
                }
                resolve(events)
            });

        } else {
            resolve(events)
        }
        
    });
}

function processUpdates(conn, sfObject, endpoints, pinpointEvents){
    return new Promise((resolve) => {
        var endpointsToUpdate = [];
        var events = {};
        var updateAttribute = process.env.UPDATEATTRIBUTE;

        Object.keys(endpoints).forEach(function (endpointID) {
            var endpoint = endpoints[endpointID]

            if (updateAttribute){
                if (endpoint.Attributes[updateAttribute] && endpoint.Attributes[updateAttribute][0]) {
                    tempObject = buildSFObjectFromEndpoint(endpoint);
                    tempObject.Id = endpoint.Attributes[updateAttribute][0];
                    endpointsToUpdate.push(tempObject);
                }
            } 
        })
        

        if(endpointsToUpdate.length === 1){
            //Just a single record to update, so make single API call
            console.log("Found Single Object to Update:");
            console.log(JSON.stringify(endpointsToUpdate[0]));

            conn.sobject(sfObject).update(endpointsToUpdate[0], function(err, ret) {
                console.log("Single Update");
                if (err || !ret.success) { 
                    console.error(err, ret); 
                } else {
                    console.log("Updated record id : " + ret.id);
                }
                resolve(events)
            });
        } else if (endpointsToUpdate.length > 1){
            //Multiple records to update, so make use of bulk api to optimize API call limits.
            
            console.log("Found Multiple Objects to Update");
            console.log(JSON.stringify(endpointsToUpdate));

            conn.bulk.load(sfObject, "update", endpointstoUpdate, function(err, rets) {
                console.log("BULKLoad--Update");
                if (err) { 
                     console.error(err); 
                } else {
                    for (var i=0; i < rets.length; i++) {
                        if (rets[i].success) {
                            console.log("#" + (i+1) + " updated successfully, id = " + rets[i].id);
                        } else {
                            console.log("#" + (i+1) + " update error occurred, message = " + rets[i].errors.join(', '));
                        }
                    }
                }
                resolve(events)
            });

        } else {
            resolve(events)
        }
    });
}

function processEvents(events){
    return new Promise((resolve) => {
        console.log("processEvents");
        resolve({});
    });
}

function addSFObjects(event){
    return new Promise((resolve) => {
        try {

            if (event.Endpoints.length === 0) {
console.log(1);
                resolve({"message":"no endpoints to process"})
            }
console.log(2);
            var params = {
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: generateSFJWT()
            };
    
            var token_url = new url.URL('/services/oauth2/token', process.env.SFLOGINURL).toString();

            axios.post(token_url, querystring.stringify(params))
            .then(function (res) {
console.log(3);
                var conn = new jsforce.Connection({
                    instanceUrl: res.data.instance_url,
                    accessToken: res.data.access_token
                });

                var sfObject = process.env.SFOBJECTTYPE;
                var pinpointEvents = {}

                processInserts(conn, sfObject, event.Endpoints, pinpointEvents)
                .then(function(insertEvents){
console.log(4);
                    return processUpdates(conn, sfObject, event.Endpoints, pinpointEvents)
                })
                .then(function(updateEvents){
console.log(5);
                    return processEvents(pinpointEvents)
                })
                .then(function(){
console.log(6);
                    resolve({"message":"success"}) //TODO: update with events
                })
                .catch(function(err){
                    console.error(err);
                    resolve({"message":"error"})
                })

    
                // conn.query('SELECT Id, Name FROM Account LIMIT 1', function (err, results) {
                //     if (err){
                //         console.log(err);
                //         throw new Error(`error calling sfdc api: ${err}`)
                //     } else {
                //         console.log(JSON.stringify(results.records[0])); // eslint-disable-line no-console
                //         resolve({"message":"success"})
                //     }
                // });
            })
            .catch(function(err){
                console.log(err);
                //throw new Error(`error getting token: ${err}`)
                resolve({"message":`error getting token: ${err}`})
            });
        } catch (err) {
            //throw new Error(`unknown error: ${err}`)
            resolve({"message":`unknown error: ${err}`})
        }
    });
}

exports.handler = async (event, context) => {
    
    console.log(event);
    body = await addSFObjects(event);

    response = {
        'statusCode': 200,
        'body': JSON.stringify(body)
    }
    
    return response;
};
