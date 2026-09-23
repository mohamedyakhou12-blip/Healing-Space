#!/usr/bin/env python3
"""
Test admin code change flow
"""
import json
import firebase_admin
from firebase_admin import credentials, firestore

# Load service account
KEY_PATH = "/home/z/my-project/upload/healing-space-5a76f-firebase-adminsdk-fbsvc-9a74025736.json"
with open(KEY_PATH) as f:
    sa = json.load(f)

cred = credentials.Certificate(sa)
app = firebase_admin.initialize_app(cred)
db = firestore.client()

print("=== Step 1: Read current admin_access_code from Firestore ===")
docs = db.collection('siteSettings').where('key', '==', 'admin_access_code').limit(1).stream()
found = None
for doc in docs:
    found = doc.to_dict()
    found_id = doc.id
    print(f"Document ID: {found_id}")
    print(f"Key: {found.get('key', '')}")
    print(f"Value (current code): {found.get('value', '')}")
    print(f"CreatedAt: {found.get('createdAt', '?')}")
    print(f"UpdatedAt: {found.get('updatedAt', '?')}")

if not found:
    print("❌ No admin_access_code document found!")
    
    # Check what's there
    print("\n=== All siteSettings documents ===")
    all_docs = db.collection('siteSettings').limit(50).stream()
    for doc in all_docs:
        data = doc.to_dict()
        print(f"  ID: {doc.id}, Key: {data.get('key','?')}, Value: {str(data.get('value',''))[:30]}")
else:
    print(f"\n✅ Found admin_access_code document")
    print(f"   Current value: '{found.get('value', '')}'")
    print(f"   Document ID: '{found_id}'")
    
    # Now test updating it
    print("\n=== Step 2: Test update via set() with merge ===")
    new_test_code = "TEST_CODE_123"
    doc_ref = db.collection('siteSettings').document(found_id)
    doc_ref.set({
        'value': new_test_code,
        'updatedAt': firestore.SERVER_TIMESTAMP
    }, merge=True)
    
    print(f"✅ Wrote value='{new_test_code}' to doc {found_id}")
    
    # Verify
    print("\n=== Step 3: Verify by reading back ===")
    doc = doc_ref.get()
    if doc.exists:
        data = doc.to_dict()
        print(f"Value after update: '{data.get('value', '')}'")
        if data.get('value') == new_test_code:
            print("✅ Update was successful!")
        else:
            print("❌ Update FAILED - value didn't change!")
    
    # Restore the original code
    print("\n=== Step 4: Restore original code ===")
    original_code = found.get('value', '052307')
    doc_ref.set({
        'value': original_code,
        'updatedAt': firestore.SERVER_TIMESTAMP
    }, merge=True)
    print(f"✅ Restored to '{original_code}'")
    
    # Verify restoration
    doc = doc_ref.get()
    data = doc.to_dict()
    print(f"Final value in DB: '{data.get('value', '')}'")

firebase_admin.delete_app(app)
