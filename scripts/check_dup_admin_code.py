#!/usr/bin/env python3
"""
Check for duplicate admin_access_code documents in Firestore
"""
import json
import firebase_admin
from firebase_admin import credentials, firestore

KEY_PATH = "/home/z/my-project/upload/healing-space-5a76f-firebase-adminsdk-fbsvc-9a74025736.json"
with open(KEY_PATH) as f:
    sa = json.load(f)

try:
    firebase_admin.delete_app(firebase_admin.get_app())
except:
    pass

cred = credentials.Certificate(sa)
app = firebase_admin.initialize_app(cred)
db = firestore.client()

print("=== Checking for ALL admin_access_code documents ===\n")
docs = list(db.collection('siteSettings').where('key', '==', 'admin_access_code').stream())
print(f"Found {len(docs)} document(s) with key='admin_access_code':\n")

for i, doc in enumerate(docs):
    data = doc.to_dict()
    print(f"[{i+1}] ID: {doc.id}")
    print(f"    Value: '{data.get('value', '')}'")
    print(f"    CreatedAt: {data.get('createdAt', '?')}")
    print(f"    UpdatedAt: {data.get('updatedAt', '?')}")
    print()

# Now check the actual order Firestore returns them
print("=== Raw order from Firestore (no sort) ===")
for i, doc in enumerate(docs):
    data = doc.to_dict()
    print(f"[{i+1}] ID={doc.id}, Value='{data.get('value','')}', UpdatedAt={data.get('updatedAt','?')}")

firebase_admin.delete_app(app)
