/**
 * 8 Senses API Testing Script for Gallery and Diseases APIs
 * 
 * This file contains code to test the Gallery and Diseases APIs in Postman.
 * It includes variables, test examples, and pre-request scripts.
 * 
 * To use this file:
 * 1. Copy the code sections into your Postman collection or requests
 * 2. Set up environment variables for baseUrl, adminToken, and userToken
 * 3. Run the requests in the suggested order
 */

/**
 * =======================
 * ENVIRONMENT VARIABLES
 * =======================
 * 
 * Create these in your Postman environment:
 * - baseUrl: Your API base URL (e.g., http://localhost:5000/api)
 * - adminToken: JWT token for admin user
 * - userToken: JWT token for regular user
 */

/**
 * =======================
 * AUTHENTICATION
 * =======================
 */

// Login as Admin (POST /api/auth/login)
// Body:
{
  "email": "admin@example.com",
  "password": "yourpassword"
}

// Test Script for Login:
pm.test("Login successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.token).to.exist;
  
  // Save the token to environment variable
  pm.environment.set("adminToken", jsonData.token);
});

/**
 * =======================
 * GALLERY API TESTS
 * =======================
 */

// 1. GET GALLERY IMAGES (PUBLIC)
// GET {{baseUrl}}/gallery

// Test Script:
pm.test("Get gallery images successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data).to.be.an('array');
});

// 2. GET GALLERY IMAGE BY ID (PUBLIC)
// GET {{baseUrl}}/gallery/:id

// Test Script:
pm.test("Get gallery image by ID successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data).to.be.an('object');
  pm.expect(jsonData.data.title).to.exist;
});

// 3. CREATE GALLERY IMAGE (ADMIN ONLY)
// POST {{baseUrl}}/gallery
// Headers: Authorization: Bearer {{adminToken}}
// Body:
{
  "title": "Test Gallery Image",
  "description": "This is a test image for the gallery",
  "imageUrl": "https://res.cloudinary.com/your-cloud-name/image/upload/v1234567890/8senses/gallery/test_image.jpg",
  "publicId": "8senses/gallery/test_image",
  "category": "Clinic",
  "featured": false,
  "order": 1
}

// Test Script:
pm.test("Create gallery image successful", function () {
  pm.response.to.have.status(201);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data).to.be.an('object');
  pm.expect(jsonData.data._id).to.exist;
  
  // Save the new image ID for later tests
  pm.environment.set("galleryImageId", jsonData.data._id);
});

// 4. UPDATE GALLERY IMAGE (ADMIN ONLY)
// PUT {{baseUrl}}/gallery/:id
// Headers: Authorization: Bearer {{adminToken}}
// Body:
{
  "title": "Updated Gallery Image",
  "description": "This image has been updated",
  "featured": true
}

// Test Script:
pm.test("Update gallery image successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data.title).to.equal("Updated Gallery Image");
});

// 5. GET GALLERY STATS (ADMIN ONLY)
// GET {{baseUrl}}/gallery/stats/summary
// Headers: Authorization: Bearer {{adminToken}}

// Test Script:
pm.test("Get gallery stats successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data).to.be.an('object');
  pm.expect(jsonData.data.totalCount).to.exist;
  pm.expect(jsonData.data.categoryStats).to.be.an('array');
});

// 6. DELETE GALLERY IMAGE (ADMIN ONLY)
// DELETE {{baseUrl}}/gallery/:id
// Headers: Authorization: Bearer {{adminToken}}

// Test Script:
pm.test("Delete gallery image successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
});

/**
 * =======================
 * DISEASES API TESTS
 * =======================
 */

// 1. GET DISEASES (PUBLIC)
// GET {{baseUrl}}/diseases

// Test Script:
pm.test("Get diseases successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data).to.be.an('array');
});

// 2. GET DISEASE CATEGORIES (PUBLIC)
// GET {{baseUrl}}/diseases/categories

// Test Script:
pm.test("Get disease categories successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data).to.be.an('array');
});

// 3. GET DISEASE BY ID (PUBLIC)
// GET {{baseUrl}}/diseases/:id

// Test Script:
pm.test("Get disease by ID successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data).to.be.an('object');
  pm.expect(jsonData.data.name).to.exist;
});

// 4. CREATE DISEASE (ADMIN ONLY)
// POST {{baseUrl}}/diseases
// Headers: Authorization: Bearer {{adminToken}}
// Body:
{
  "name": "Test Disease",
  "description": "This is a test disease description with comprehensive information.",
  "symptoms": ["Symptom 1", "Symptom 2", "Symptom 3"],
  "causes": "Common causes include genetic factors and environmental conditions.",
  "diagnosis": "Diagnosis typically involves clinical evaluation and specialized tests.",
  "treatments": "Treatment options include therapy, medication, and lifestyle adjustments.",
  "category": "Developmental Disorder",
  "ageGroup": ["Infant (0-1 year)", "Toddler (1-3 years)"],
  "resources": [
    {
      "title": "Helpful Resource",
      "url": "https://example.com/resource",
      "type": "Website"
    }
  ],
  "keywords": ["test", "example", "developmental"]
}

// Test Script:
pm.test("Create disease successful", function () {
  pm.response.to.have.status(201);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data).to.be.an('object');
  pm.expect(jsonData.data._id).to.exist;
  
  // Save the new disease ID for later tests
  pm.environment.set("diseaseId", jsonData.data._id);
});

// 5. UPDATE DISEASE (ADMIN ONLY)
// PUT {{baseUrl}}/diseases/:id
// Headers: Authorization: Bearer {{adminToken}}
// Body:
{
  "name": "Updated Test Disease",
  "description": "This description has been updated",
  "isPublished": true,
  "preventions": "Prevention strategies include early intervention and regular monitoring."
}

// Test Script:
pm.test("Update disease successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
  pm.expect(jsonData.data.name).to.equal("Updated Test Disease");
});

// 6. DELETE DISEASE (ADMIN ONLY)
// DELETE {{baseUrl}}/diseases/:id
// Headers: Authorization: Bearer {{adminToken}}

// Test Script:
pm.test("Delete disease successful", function () {
  pm.response.to.have.status(200);
  var jsonData = pm.response.json();
  pm.expect(jsonData.success).to.be.true;
});

/**
 * =======================
 * POSTMAN COLLECTION VARIABLES
 * =======================
 * 
 * Create these variables in your Postman collection for easy testing:
 * - galleryImageId: ID of a created gallery image
 * - diseaseId: ID of a created disease
 */

/**
 * =======================
 * USAGE NOTES
 * =======================
 * 
 * 1. Authentication:
 *    - Run the login request first to get an admin token
 *    - The token will be stored in the adminToken environment variable
 * 
 * 2. Order of Testing:
 *    - Start with GET requests (they don't modify data)
 *    - Then create resources with POST
 *    - Test updating with PUT
 *    - Delete with DELETE last
 * 
 * 3. Error Testing:
 *    - Try accessing admin routes without a token
 *    - Try creating resources with invalid data
 *    - Try updating non-existent resources
 */ 