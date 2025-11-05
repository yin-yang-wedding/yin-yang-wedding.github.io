// Debug version - ES Modules with extensive logging
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";

// Initialize AWS services with explicit region
const secretsManagerClient = new SecretsManagerClient({ region: 'us-east-2' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);

export const handler = async (event) => {
    const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Access-Control-Max-Age': '86400'
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
        console.log('DEBUG: Function started, event:', JSON.stringify(event));
        
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
        console.log('DEBUG: Password received:', password ? 'YES' : 'NO');
        
        if (!password) {
            return {
                statusCode: 400,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Password is required' })
            };
        }
        
        // Get password from AWS Secrets Manager
        console.log('DEBUG: Attempting to get secret from Secrets Manager');
        let secretResponse;
        try {
            const command = new GetSecretValueCommand({
                SecretId: 'wedding-site-password'
            });
            secretResponse = await secretsManagerClient.send(command);
            console.log('DEBUG: Secret retrieved successfully');
        } catch (secretError) {
            console.error('Error retrieving secret:', secretError);
            if (secretError.name === 'ResourceNotFoundException') {
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
            console.log('DEBUG: Secret parsed, has password field:', 'password' in secrets);
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
        
        console.log('DEBUG: Password comparison - input:', password, 'correct:', correctPassword, 'match:', password === correctPassword);
        
        if (password !== correctPassword) {
            console.log('Invalid password attempt');
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid password' })
            };
        }
        
        console.log('DEBUG: Password authenticated successfully, fetching DynamoDB data');
        
        // Fetch wedding data from DynamoDB
        let weddingData;
        try {
            console.log('DEBUG: Creating DynamoDB GetCommand for table: WeddingData, key: { id: "main" }');
            console.log('DEBUG: DynamoDB client region: us-east-2');
            
            const command = new GetCommand({
                TableName: 'WeddingData',
                Key: { id: 'main' }
            });
            
            console.log('DEBUG: Sending DynamoDB command');
            weddingData = await dynamodb.send(command);
            console.log('DEBUG: DynamoDB response received:', JSON.stringify(weddingData, null, 2));
            console.log('DEBUG: Has Item?', !!weddingData.Item);
            
            if (weddingData.Item) {
                console.log('DEBUG: Item keys:', Object.keys(weddingData.Item));
                console.log('DEBUG: Item id:', weddingData.Item.id);
                console.log('DEBUG: Has content?', !!weddingData.Item.content);
                console.log('DEBUG: Content length:', weddingData.Item.content ? weddingData.Item.content.length : 0);
            }
            
        } catch (dbError) {
            console.error('DynamoDB error:', dbError);
            console.error('Error name:', dbError.name);
            console.error('Error message:', dbError.message);
            console.error('Error stack:', dbError.stack);
            
            if (dbError.name === 'ResourceNotFoundException') {
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
            console.error('DEBUG: Wedding data item not found - no Item in response');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Wedding content not found' })
            };
        }
        
        if (!weddingData.Item.content) {
            console.error('DEBUG: Wedding content is empty - Item exists but no content field');
            console.error('DEBUG: Available fields in Item:', Object.keys(weddingData.Item));
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Wedding content is empty' })
            };
        }
        
        console.log('DEBUG: Returning successful response with content');
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                content: weddingData.Item.content,
                lastUpdated: weddingData.Item.lastUpdated 
            })
        };
        
    } catch (error) {
        console.error('DEBUG: Unexpected error:', error);
        console.error('DEBUG: Error stack:', error.stack);
        return {
            statusCode: 500,
            headers: corsHeaders,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
