# Lambda Function 502 Error Fix Guide

## ✅ DIAGNOSIS COMPLETE
**The issue is NOT CORS** - CORS is working perfectly!

**The real problem**: Lambda function is returning **502 Internal Server Error**

## 🔍 Test Results
```bash
# ✅ CORS Preflight (OPTIONS) - WORKING
curl -X OPTIONS https://qfp9pvx3b6.execute-api.us-east-2.amazonaws.com/prod/content
# Returns: 200 OK with proper CORS headers

# ❌ Lambda Function (POST) - FAILING  
curl -X POST https://qfp9pvx3b6.execute-api.us-east-2.amazonaws.com/prod/content
# Returns: 502 Internal Server Error
```

## 🚨 IMMEDIATE ACTION REQUIRED

### Step 1: Update Lambda Function Code
**CRITICAL**: You need to update your Lambda function in AWS with the new code from `lambda-function.js`

1. Go to **AWS Lambda Console**
2. Find your `wedding-content` function
3. Replace the entire code with the contents of `lambda-function.js`
4. Click **Deploy**

### Step 2: Verify AWS Resources Exist

#### Check Secrets Manager
1. Go to **AWS Secrets Manager Console**
2. Verify secret named `wedding-site-password` exists in **us-east-2** region
3. Verify it contains: `{"password": "your-actual-password"}`

#### Check DynamoDB Table
1. Go to **AWS DynamoDB Console**
2. Verify table named `WeddingData` exists in **us-east-2** region
3. Verify it has an item with `id: "main"` and `content` field

#### Check Lambda Permissions
1. Go to **AWS Lambda Console** → `wedding-content` function
2. Go to **Configuration** → **Permissions**
3. Verify the execution role has permissions for:
   - Secrets Manager: `GetSecretValue`
   - DynamoDB: `GetItem`
   - CloudWatch Logs: `CreateLogGroup`, `CreateLogStream`, `PutLogEvents`

### Step 3: Check CloudWatch Logs
1. Go to **AWS CloudWatch Console**
2. Navigate to **Log groups**
3. Find `/aws/lambda/wedding-content`
4. Check recent log streams for error details

## 🔧 Quick Setup Commands

If you need to set up the AWS resources, you can use the data management script:

```bash
# Install AWS SDK (if not already installed)
npm install aws-sdk

# Set up DynamoDB table and sample data
node data-management.js setup
```

## 🧪 Testing After Fix

Once you've updated the Lambda function, test with:

```bash
# Test with wrong password (should return 401)
curl -X POST https://qfp9pvx3b6.execute-api.us-east-2.amazonaws.com/prod/content \
  -H "Content-Type: application/json" \
  -d '{"password":"wrongpassword"}'

# Test with correct password (should return 200 with content)
curl -X POST https://qfp9pvx3b6.execute-api.us-east-2.amazonaws.com/prod/content \
  -H "Content-Type: application/json" \
  -d '{"password":"your-actual-password"}'
```

## 🎯 Expected Responses

### Wrong Password (401):
```json
{"error": "Invalid password"}
```

### Correct Password (200):
```json
{
  "content": "<div class=\"content-section\">...</div>",
  "lastUpdated": "2024-01-15T10:00:00Z"
}
```

### Missing Resources (500):
```json
{"error": "Authentication configuration error"}
{"error": "Wedding content not found"}
{"error": "Database service unavailable"}
```

## 🔍 Common 502 Error Causes

1. **Lambda function not updated** - Most likely cause
2. **Missing Secrets Manager secret** - Function can't authenticate
3. **Missing DynamoDB table/item** - Function can't retrieve content
4. **Wrong region configuration** - Resources in different region
5. **Lambda timeout** - Function taking too long (increase timeout)
6. **Memory issues** - Function running out of memory
7. **Syntax errors** - Code has JavaScript errors

## 📋 Checklist

- [ ] Update Lambda function code in AWS Console
- [ ] Verify `wedding-site-password` secret exists in us-east-2
- [ ] Verify `WeddingData` table exists in us-east-2 with content
- [ ] Check Lambda execution role permissions
- [ ] Test API with curl commands
- [ ] Check CloudWatch logs for specific errors
- [ ] Test website after Lambda update

## 🚀 Once Fixed

After updating the Lambda function, the website should work immediately. The browser will show the proper error messages we implemented instead of generic "network error".

**The CORS configuration is already perfect** - no changes needed there!
