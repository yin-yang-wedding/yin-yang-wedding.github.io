// ES Modules version for AWS Lambda with S3 Photo Support
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize AWS services with explicit region
const secretsManagerClient = new SecretsManagerClient({ region: 'us-east-2' });
const dynamoClient = new DynamoDBClient({ region: 'us-east-2' });
const dynamodb = DynamoDBDocumentClient.from(dynamoClient);
const s3Client = new S3Client({ region: 'us-east-2' });

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
            const command = new GetSecretValueCommand({
                SecretId: 'wedding-site-password'
            });
            secretResponse = await secretsManagerClient.send(command);
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
            const command = new GetCommand({
                TableName: 'WeddingData',
                Key: { id: 'main' }
            });
            weddingData = await dynamodb.send(command);
        } catch (dbError) {
            console.error('DynamoDB error:', dbError);
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
        
        // Fetch photos from S3
        let photos = [];
        try {
            const bucketName = 'wedding-website-photos';
            
            // List objects in the S3 bucket
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                MaxKeys: 100 // Limit to 100 photos for performance
            });
            
            const listResult = await s3Client.send(listCommand);
            
            if (listResult.Contents && listResult.Contents.length > 0) {
                // Filter for image files and generate signed URLs
                const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                const imageObjects = listResult.Contents.filter(obj => {
                    const key = obj.Key.toLowerCase();
                    return imageExtensions.some(ext => key.endsWith(ext));
                });
                
                // Generate signed URLs for each image
                photos = await Promise.all(
                    imageObjects.map(async (obj) => {
                        try {
                            const getObjectCommand = new GetObjectCommand({
                                Bucket: bucketName,
                                Key: obj.Key
                            });
                            
                            const signedUrl = await getSignedUrl(s3Client, getObjectCommand, {
                                expiresIn: 3600 // URL expires in 1 hour
                            });
                            
                            return {
                                key: obj.Key,
                                url: signedUrl,
                                size: obj.Size,
                                lastModified: obj.LastModified
                            };
                        } catch (urlError) {
                            console.error(`Error generating signed URL for ${obj.Key}:`, urlError);
                            return null;
                        }
                    })
                );
                
                // Remove any null entries (failed URL generation)
                photos = photos.filter(photo => photo !== null);
                
                // Sort photos by last modified date (newest first)
                photos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
            }
            
        } catch (s3Error) {
            console.error('Error fetching photos from S3:', s3Error);
            // Don't fail the entire request if photos can't be loaded
            // Just return empty photos array
            photos = [];
        }
        
        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({ 
                content: weddingData.Item.content,
                lastUpdated: weddingData.Item.lastUpdated,
                photos: photos
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
