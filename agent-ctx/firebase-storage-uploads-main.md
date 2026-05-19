# Task: Firebase Storage Uploads & Allow All File Types

## Task ID: firebase-storage-uploads
## Agent: main

## Summary

Implemented Firebase Storage for file uploads, allowing all file types in admin uploads, increasing max file size limits, and keeping receipt uploads working (also moved to Firebase Storage).

## Files Created

1. **`/home/z/my-project/src/lib/firebase-storage.ts`** - Firebase Storage initialization module that reuses the existing admin app from firebase-admin.ts

2. **`/home/z/my-project/src/app/api/upload/route.ts`** - Upload API endpoint with:
   - POST: Accepts multipart form data, validates file (type, size), uploads to Firebase Storage, returns download URL
   - DELETE: Removes a file from storage (admin only)
   - Max 100MB for admin uploads, 20MB for receipts
   - Blocks dangerous file extensions (.exe, .bat, .sh, .php, etc.)
   - Admin auth required for content uploads, regular auth for receipts

## Files Modified

3. **`/home/z/my-project/src/lib/firebase-admin.ts`** - Added `storageBucket` option to all `initializeApp()` calls so the admin app knows about the storage bucket

4. **`/home/z/my-project/src/lib/api-helpers.ts`** - Added `adminFormDataHeaders()` function that doesn't set Content-Type (needed for FormData uploads where the browser sets the boundary)

5. **`/home/z/my-project/src/components/pages/AdminPage.tsx`** - Major updates to FileUploadComponent:
   - Removed hardcoded type arrays (ACCEPTED_IMAGE_TYPES, ACCEPTED_AUDIO_TYPES, etc.)
   - Updated `getFileTypeInfo()` to support more file types using `startsWith()` instead of exact match
   - Added `maxSizeMB` and `uploadType` props
   - Replaced `FileReader.readAsDataURL` with `fetch('/api/upload')` using FormData
   - Added upload progress bar with simulated progress
   - Stores Firebase Storage URL instead of base64
   - Removed `accept` attribute restriction on file input
   - Updated preview to handle both base64 and URL values (backward compatible)
   - Updated both usages to use new props

6. **`/home/z/my-project/src/components/pages/PaymentPage.tsx`** - Updated receipt upload:
   - Allows images AND PDFs for receipts
   - Uploads to Firebase Storage via `/api/upload` with type="receipt"
   - Stores Firebase Storage URL instead of base64
   - Increased max size to 20MB
   - Added separate `isUploadingReceipt` state for upload progress
   - Added loading spinner during upload
   - PDF preview shows icon instead of broken image
   - Updated submit button to show upload status
   - Updated help text to mention PDF support and 20MB limit

7. **`/home/z/my-project/src/app/api/payments/route.ts`** - Updated `validateReceiptSize` → `validateReceipt`:
   - Now validates Firebase Storage URLs (allows googleapis.com domains)
   - Allows any HTTPS URL (backward compatibility)
   - Keeps base64 validation but increased max from 5MB to 20MB

8. **`/home/z/my-project/src/app/api/purchases/route.ts`** - Same changes as payments route

## Key Design Decisions

- **Backward compatibility**: Existing base64 values in Firestore still work - the preview and API routes handle both URLs and base64
- **Lazy import**: Firebase Storage module is imported lazily in the upload API route so the module doesn't crash if Storage isn't configured
- **Security**: Dangerous file extensions are blocked server-side, only admin can upload content files, regular users can only upload receipts
- **Signed URLs**: Files get signed URLs valid until 2491 (practically permanent)
- **Storage bucket fallback**: If `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` env var isn't set, defaults to `{project-id}.appspot.com`
