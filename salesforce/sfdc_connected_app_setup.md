# Configuring a Salesforce Connected App

This solution will use the [OAuth 2.0 JWT Bearer Flow for Server-to-Server Integration](https://help.salesforce.com/articleView?id=remoteaccess_oauth_jwt_flow.htm&type=5) 

## Certificate Generation

Use `openssl` to generate keys:
```bash
openssl req -newkey rsa:2048 -nodes -keyout key.pem -x509 -days 365 -out certificate.pem
```

## Salesforce Connected App

https://help.salesforce.com/articleView?id=connected_app_create_api_integration.htm&type=5

1. Login to your Salesforce Account.  A free developer account works as well.
2. Switch to **Setup**

![SFDC Setup](images/setup_1.png)
