let response;
let jsforce = require('jsforce');
let axios = require('axios');
let moment = require('moment');
let jwt = require('jsonwebtoken');
let url = require('url');
let querystring = require('querystring');

function reBuildPrivateKey() {
  var beginPk = "-----BEGIN PRIVATE KEY-----\n";
  var endPk   = "\n-----END PRIVATE KEY-----\n";
  return( beginPk + process.env.SFPRIVATEKEY.split(' ').concat().join('\n') + endPk);
}

function addSFObject(message){
    return new Promise((resolve) => {
        try {

            var consumerKey = process.env.SFCONSUMERKEY; 
            var awsApiUser = process.env.SFAPIUSERNAME; 
            var privateKey = reBuildPrivateKey(); 
            var sandbox = (process.env.SANDBOX == 'true');  
            var instanceUrl = process.env.SFLOGINURL;
    
            var jwtparams = {
                iss: consumerKey,
                prn: awsApiUser,
                aud: instanceUrl,
                exp: parseInt(moment().add(2, 'minutes').format('X'))
            };
    
            var token = jwt.sign(jwtparams, privateKey, { algorithm: 'RS256' });
    
            var params = {
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: token
            };
    
            var token_url = new url.URL('/services/oauth2/token', instanceUrl).toString();

            axios.post(token_url, querystring.stringify(params))
            .then(function (res) {
                var conn = new jsforce.Connection({
                    instanceUrl: res.data.instance_url,
                    accessToken: res.data.access_token
                });
    
                conn.query('SELECT Id, Name FROM Account LIMIT 1', function (err, results) {
                    if (err){
                        console.log(err);
                        throw new Error(`error calling sfdc api: ${err}`)
                    } else {
                        console.log(JSON.stringify(results.records[0])); // eslint-disable-line no-console
                        resolve({"message":"success"})
                    }
                });
            })
            .catch(function(err){
                console.log(err);
                throw new Error(`error getting token: ${err}`)
            });
        } catch (err) {
            throw new Error(`unknown error: ${err}`)
        }
    });
}

exports.handler = async (event, context) => {
    
    console.log(event);
    body = await addSFObject();

    response = {
        'statusCode': 200,
        'body': JSON.stringify(body)
    }
    
    return response;
};
