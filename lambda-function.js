const AWS = require('aws-sdk');

// Initialize AWS services
const secretsManager = new AWS.SecretsManager();
const dynamodb = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: ''
        };
    }

    try {
        const { password } = JSON.parse(event.body);
        
        // Get password from AWS Secrets Manager
        const secretResponse = await secretsManager.getSecretValue({
            SecretId: 'wedding-site-password'
        }).promise();
        
        const secrets = JSON.parse(secretResponse.SecretString);
        const correctPassword = secrets.password;
        
        if (password !== correctPassword) {
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid password' })
            };
        }
        
        // Fetch wedding data from DynamoDB
        const weddingData = await dynamodb.get({
            TableName: 'WeddingData',
            Key: { id: 'main' }
        }).promise();
        
        if (!weddingData.Item) {
            throw new Error('Wedding data not found');
        }
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                content: weddingData.Item.content,
                lastUpdated: weddingData.Item.lastUpdated 
            })
        };
        
    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
