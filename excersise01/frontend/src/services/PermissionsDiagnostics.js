// src/services/PermissionsDiagnostics.js
import {
  universalAccess,
  getSolidDataset,
  getContainedResourceUrlAll,
} from "@inrupt/solid-client";

function rootPodUrl(podUrl) {
  let b = (podUrl || "").trim().replace(/\/+$/, "");
  b = b.replace(/\/(public|private)(\/.*)?$/i, "");
  return b;
}

/**
 * Comprehensive diagnostics for access control
 */
export async function diagnoseAccessControl({ podUrl, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  const results = {
    containerUrl,
    accessControlType: "WAC",
    publicAccess: null,
    files: [],
    errors: [],
  };

  try {
    // Get the dataset
    const dataset = await getSolidDataset(containerUrl, { fetch });

    // Check public access (WAC)
    try {
      const publicAccess = await universalAccess.getPublicAccess(containerUrl, { fetch });
      results.publicAccess = publicAccess;
      console.log("[Diagnostics] Public access settings:", publicAccess);
    } catch (e) {
      results.errors.push("Could not get public access: " + e.message);
    }

    // Get all files and check their access
    try {
      const contained = getContainedResourceUrlAll(dataset);
      console.log("[Diagnostics] Found files:", contained);

      for (const fileUrl of contained) {
        const fileInfo = {
          url: fileUrl,
          publicAccess: null,
          error: null,
        };

        try {
          const fileAccess = await universalAccess.getPublicAccess(fileUrl, { fetch });
          fileInfo.publicAccess = fileAccess;
        } catch (e) {
          fileInfo.error = e.message;
        }

        results.files.push(fileInfo);
      }
    } catch (e) {
      results.errors.push("Could not list files: " + e.message);
    }

  } catch (e) {
    results.errors.push("Container access failed: " + e.message);
    console.error("[Diagnostics] Error:", e);
  }

  return results;
}

/**
 * Test anonymous access to a URL (without authentication)
 * This tests if the resource is ACTUALLY publicly accessible
 */
export async function testAnonymousAccess(resourceUrl) {
  try {
    // Use fetch WITHOUT authentication
    const response = await fetch(resourceUrl, {
      method: "HEAD",
      credentials: "omit", // Don't send credentials
      mode: "cors",
    });

    return {
      url: resourceUrl,
      accessible: response.ok,
      status: response.status,
      statusText: response.statusText,
      requiresAuth: response.status === 401 || response.status === 403,
    };
  } catch (e) {
    return {
      url: resourceUrl,
      accessible: false,
      error: e.message,
      requiresAuth: true,
    };
  }
}

/**
 * Placeholder for ACP-based public access
 * Note: ACP support requires additional packages and may not be available
 */
export async function makePublicUsingACP({ podUrl, fetch }) {
  return {
    success: false,
    message: "ACP is not supported in this version. Use friend-based sharing instead.",
  };
}
