* Phaxio Pinpoint Custom Channel [WIP]
This is still a work in process, but it does work.

** Architecture
[TODO]

** Overview
- **custom-channel** - This is the [custom channel](https://docs.aws.amazon.com/pinpoint/latest/developerguide/channels-custom.html) that Pinpoint will call.  This will write messages to an SQS queue for the queue processor below. Requires the following Environment variables: PHAXIO_SQS_QUEUE_URL, S3_BUCKET
- **queue-processor** - Will read messages from SQS queue and execute Phaxio API calls. Requires the following Environment variables: PHAXIOKEY PHAXIOSECRET
- **phaxio-webhook-handler** - Tied to API Gateway and will accept Phaxio Webhook calls once fax has completed.  Will write Pinpint custom events for success and error messages.

** Getting Started [These are rough, but will get much better when we have the CF template to do all of this]
- Sign up for Phaxio account.  You can use Test API keys to call the API with no cost.  It will simulate sending a fax and you can also pass an parameter to the API call to simulate failures.
- Create Lambda to accept an API Gateway request.  It's easier to do this through the **Lambda Microservices** Blueprint as it will create the Lambda, API Gateway, and associated permissions.  This Lambda will also need ability to write events to Pinpoint.
- Create Custom Channel Lambda and grant access for Pinpoint to call the Lambda: [Instructions](https://docs.aws.amazon.com/pinpoint/latest/developerguide/channels-custom.html).  This will also need access to a S3 Bucket and ability to send messages to SQS below.
- Create SQS FIFO Queue
- Create Queue Processor Lambda with ability to read from SQS Queue above and Read from S3 bucket above.

** TODO
- Convert to SAM Template