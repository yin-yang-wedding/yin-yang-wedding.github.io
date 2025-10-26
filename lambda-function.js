const AWS = require('aws-sdk');

// Initialize AWS services with explicit region
const secretsManager = new AWS.SecretsManager({ region: 'us-east-2' });
const dynamodb = new AWS.DynamoDB.DocumentClient({ region: 'us-east-2' });

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
        // Validate request body
        if (!event.body) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Missing request body' })
            };
        }

        let requestData;
        try {
            requestData = JSON.parse(event.body);
        } catch (parseError) {
            console.error('Invalid JSON in request body:', parseError);
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid JSON format' })
            };
        }

        const { password } = requestData;
        
        if (!password) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Password is required' })
            };
        }
        
        // Get password from AWS Secrets Manager
        let secretResponse;
        try {
            secretResponse = await secretsManager.getSecretValue({
                SecretId: 'wedding-site-password'
            }).promise();
        } catch (secretError) {
            console.error('Error retrieving secret:', secretError);
            if (secretError.code === 'ResourceNotFoundException') {
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Authentication configuration error' })
                };
            }
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Authentication service unavailable' })
            };
        }
        
        let secrets;
        try {
            secrets = JSON.parse(secretResponse.SecretString);
        } catch (parseError) {
            console.error('Error parsing secret:', parseError);
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Authentication configuration error' })
            };
        }
        
        const correctPassword = secrets.password;
        
        if (!correctPassword) {
            console.error('Password not found in secret');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Authentication configuration error' })
            };
        }
        
        if (password !== correctPassword) {
            console.log('Invalid password attempt');
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid password' })
            };
        }
        
        // Fetch wedding data from DynamoDB
        let weddingData;
        try {
            weddingData = await dynamodb.get({
                TableName: 'WeddingData',
                Key: { id: 'main' }
            }).promise();
        } catch (dbError) {
            console.error('DynamoDB error:', dbError);
            if (dbError.code === 'ResourceNotFoundException') {
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Wedding data not configured' })
                };
            }
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Database service unavailable' })
            };
        }
        
        if (!weddingData.Item) {
            console.error('Wedding data item not found');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Wedding content not found' })
            };
        }
        
        if (!weddingData.Item.content) {
            console.error('Wedding content is empty');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Wedding content is empty' })
            };
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
        console.error('Unexpected error:', error);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
