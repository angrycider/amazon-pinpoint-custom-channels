let response;

exports.handler = async (event, context) => {
    try {
        console.log(event)
        console.log(process.env.SFAPIUSERNAME)
        response = {
            'statusCode': 200,
            'body': JSON.stringify({
                message: 'success',
            })
        }
    } catch (err) {
        console.log(err);
        return err;
    }

    return response
};
