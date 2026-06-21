// ES Modules version for AWS Lambda with Multi-Password Support and Different Content
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

        // Get passwords from AWS Secrets Manager
        let secretResponse;
        try {
            const command = new GetSecretValueCommand({
                SecretId: 'wedding-site-password'
            });
            secretResponse = await secretsManagerClient.send(command);
        } catch (secretError) {
            console.error('Error retrieving secret:', secretError);
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: `Secret error: ${secretError.message}` })
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

        // Check which password was used and determine user type
        let userType = null;
        let contentId = null;

        if (secrets.password_family && password === secrets.password_family) {
            userType = 'family';
            contentId = 'wedding-data-family';
        } else if (secrets.password_friends && password === secrets.password_friends) {
            userType = 'friends';
            contentId = 'friends';
        } else if (secrets.password && password === secrets.password) {
            // Backward compatibility with single password
            userType = 'main';
            contentId = 'main';
        } else {
            console.log('Invalid password attempt');
            return {
                statusCode: 401,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Invalid password' })
            };
        }

        // Fetch wedding data from DynamoDB based on user type
        let weddingData;
        try {
            const command = new GetCommand({
                TableName: 'WeddingData',
                Key: { id: contentId }
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
            console.error(`Wedding data item not found for content ID: ${contentId}`);
            // Fall back to main content if specific content not found
            if (contentId !== 'main') {
                try {
                    const fallbackCommand = new GetCommand({
                        TableName: 'WeddingData',
                        Key: { id: 'main' }
                    });
                    weddingData = await dynamodb.send(fallbackCommand);
                    if (!weddingData.Item) {
                        return {
                            statusCode: 500,
                            headers: corsHeaders,
                            body: JSON.stringify({ error: 'Wedding content not found' })
                        };
                    }
                } catch (fallbackError) {
                    return {
                        statusCode: 500,
                        headers: corsHeaders,
                        body: JSON.stringify({ error: 'Wedding content not found' })
                    };
                }
            } else {
                return {
                    statusCode: 500,
                    headers: corsHeaders,
                    body: JSON.stringify({ error: 'Wedding content not found' })
                };
            }
        }

        if (!weddingData.Item.content) {
            console.error('Wedding content is empty');
            return {
                statusCode: 500,
                headers: corsHeaders,
                body: JSON.stringify({ error: 'Wedding content is empty' })
            };
        }

        // Rewrite {{asset:KEY}} placeholders in the content with short-lived signed
        // URLs from the private assets bucket, so these images stay behind auth
        // (the bucket is never public; URLs expire in 1 hour like the gallery photos).
        let content = weddingData.Item.content;
        try {
            const assetsBucket = 'wedding-website-assets-781108904108-us-east-2-an';
            const assetRegex = /\{\{asset:([^}]+)\}\}/g;
            const assetKeys = [...new Set([...content.matchAll(assetRegex)].map(m => m[1].trim()))];

            if (assetKeys.length > 0) {
                const signed = await Promise.all(assetKeys.map(async (key) => {
                    const getObjectCommand = new GetObjectCommand({ Bucket: assetsBucket, Key: key });
                    const url = await getSignedUrl(s3Client, getObjectCommand, { expiresIn: 3600 });
                    return [key, url];
                }));
                const urlByKey = Object.fromEntries(signed);
                // Escape & as &amp; since the URL is injected into an HTML attribute
                content = content.replace(assetRegex, (full, k) =>
                    (urlByKey[k.trim()] || full).replace(/&/g, '&amp;'));
            }
        } catch (assetError) {
            console.error('Error signing asset URLs:', assetError);
            // Leave any placeholders unresolved rather than failing the whole request
        }

        // Fetch photos from S3 - can be different folders or same photos
        let photos = [];
        try {
            const bucketName = 'wedding-website-photos';

            // Use different S3 prefixes for different user types if desired
            const photoPrefix = userType === 'family' ? 'family/' :
                               userType === 'friends' ? 'friends/' : '';

            // List objects in the S3 bucket
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
                Prefix: photoPrefix, // This allows for folder-based photo separation
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

            // If no photos found with prefix, try without prefix (shared photos)
            if (photos.length === 0 && photoPrefix) {
                const sharedListCommand = new ListObjectsV2Command({
                    Bucket: bucketName,
                    MaxKeys: 100
                });

                const sharedListResult = await s3Client.send(sharedListCommand);

                if (sharedListResult.Contents && sharedListResult.Contents.length > 0) {
                    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
                    const imageObjects = sharedListResult.Contents.filter(obj => {
                        const key = obj.Key.toLowerCase();
                        return imageExtensions.some(ext => key.endsWith(ext)) && !key.includes('/');
                    });

                    photos = await Promise.all(
                        imageObjects.map(async (obj) => {
                            try {
                                const getObjectCommand = new GetObjectCommand({
                                    Bucket: bucketName,
                                    Key: obj.Key
                                });

                                const signedUrl = await getSignedUrl(s3Client, getObjectCommand, {
                                    expiresIn: 3600
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

                    photos = photos.filter(photo => photo !== null);
                    photos.sort((a, b) => new Date(b.lastModified) - new Date(a.lastModified));
                }
            }

        } catch (s3Error) {
            console.error('Error fetching photos from S3:', s3Error);
            // Don't fail the entire request if photos can't be loaded
            photos = [];
        }

        return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify({
                content: content,
                lastUpdated: weddingData.Item.lastUpdated,
                photos: photos,
                userType: userType // Include user type in response for frontend logic
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
