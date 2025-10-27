# API Error Fix Guide - UPDATED DIAGNOSIS

## Problem Identified ✅
**GOOD NEWS**: CORS is actually working perfectly! The real issue is a **502 Internal Server Error** from the Lambda function.

## Root Cause - CORRECTED
The Lambda function is returning a 502 error, which means:
1. The Lambda function code hasn't been updated in AWS
2. There's a runtime error in the Lambda function
3. Missing AWS resources (Secrets Manager secret, DynamoDB table, or permissions)

## Test Results ✅
- ✅ OPTIONS request (CORS preflight): **WORKING** - Returns proper CORS headers
- ❌ POST request: **FAILING** - Returns 502 Internal Server Error
- ✅ API Gateway configuration: **WORKING** - Routing requests correctly

## Solution Steps

### Step 1: Update Lambda Function (COMPLETED)
✅ The Lambda function has been updated with comprehensive CORS headers.

### Step 2: Fix API Gateway CORS Configuration

#### Option A: Using AWS Console (Recommended)
1. Go to AWS API Gateway console
2. Find your `wedding-api` API
3. Navigate to the `/content` resource
4. Select the `POST` method
5. Click **Actions** → **Enable CORS**
6. Configure CORS settings:
   ```
   Access-Control-Allow-Origin: *
   Access-Control-Allow-Headers: Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Requested-With
   Access-Control-Allow-Methods: POST,OPTIONS
   ```
7. Click **Enable CORS and replace existing CORS headers**
8. **IMPORTANT**: Click **Actions** → **Deploy API**
9. Select your deployment stage (usually `prod`)
10. Click **Deploy**

#### Option B: Check Current API Gateway Configuration
1. Go to API Gateway console
2. Find your API and check if the `/content` resource exists
3. If it doesn't exist, you need to create it:
   - Click **Actions** → **Create Resource**
   - Resource Name: `content`
   - Resource Path: `/content`
   - Click **Create Resource**
4. Create POST method on `/content` resource:
   - Select the `/content` resource
   - Click **Actions** → **Create Method**
   - Select `POST` from dropdown
   - Integration Type: Lambda Function
   - Lambda Function: `wedding-content`
   - Check "Use Lambda Proxy integration"
   - Click **Save**

### Step 3: Verify API URL Structure
Your current API URL should be:
```
https://qfp9pvx3b6.execute-api.us-east-2.amazonaws.com/prod/content
```

If your API Gateway doesn't have a `/content` resource, you have two options:

#### Option A: Create the `/content` resource (Recommended)
Follow the steps in Option B above.

#### Option B: Update the frontend to use root path
Change the API URL in `protected.html` to:
```javascript
const API_URL = 'https://qfp9pvx3b6.execute-api.us-east-2.amazonaws.com/prod';
```

### Step 4: Test the Fix

After making changes:
1. Deploy your Lambda function with the updated code
2. Deploy your API Gateway changes
3. Wait 2-3 minutes for changes to propagate
4. Test the website again

### Step 5: Alternative Quick Fix (If API Gateway issues persist)

If you continue having CORS issues, you can temporarily modify the Lambda function to be more permissive:

```javascript
const corsHeaders = {
    'Access-Control-Allow-Origin': 'https://yin-yang-wedding.github.io',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': '*',
    'Access-Control-Max-Age': '86400'
};
```

## Common Issues and Solutions

### Issue 1: "Method not allowed"
- Ensure POST method is created on the correct resource
- Check that Lambda proxy integration is enabled

### Issue 2: "Resource not found" (404)
- Verify the API Gateway resource structure matches your URL
- Ensure the API is deployed after making changes

### Issue 3: Still getting CORS errors
- Check browser developer tools for the exact error
- Verify the preflight OPTIONS request is working
- Ensure API Gateway has CORS enabled AND deployed

## Verification Commands

Test your API directly using curl:

```bash
# Test OPTIONS request (preflight)
curl -X OPTIONS \
  https://qfp9pvx3b6.execute-api.us-east-2.amazonaws.com/prod/content \
  -H "Origin: https://yin-yang-wedding.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v

# Test POST request
curl -X POST \
  https://qfp9pvx3b6.execute-api.us-east-2.amazonaws.com/prod/content \
  -H "Content-Type: application/json" \
  -H "Origin: https://yin-yang-wedding.github.io" \
  -d '{"password":"your-test-password"}' \
  -v
```

## Next Steps After Fix

1. Update Lambda function code in AWS Lambda console
2. Configure API Gateway CORS settings
3. Deploy API Gateway changes
4. Test the website
5. If still having issues, check CloudWatch logs for detailed error information

The most critical step is ensuring that after making any API Gateway changes, you **DEPLOY** the API. Changes don't take effect until deployed!
