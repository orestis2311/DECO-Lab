// src/services/PermissionsDiagnostics.js
import {
  universalAccess,
  getSolidDataset,
  getContainedResourceUrlAll,
  acp_ess_2,
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
    accessControlType: "unknown",
    publicAccess: null,
    acpSupported: false,
    wacSupported: false,
    files: [],
    errors: [],
  };

  try {
    // Check if container uses ACP (Access Control Policies)
    const dataset = await getSolidDataset(containerUrl, { fetch });
    const hasAcp = acp_ess_2.hasAccessibleAcr(dataset);
    results.acpSupported = hasAcp;

    if (hasAcp) {
      results.accessControlType = "ACP";
      console.log("[Diagnostics] Container uses ACP (Access Control Policies)");

      // Try to get ACP rules
      try {
        const acrUrl = acp_ess_2.getAccessControlResourceUrl(dataset);
        results.acrUrl = acrUrl;
        console.log("[Diagnostics] ACR URL:", acrUrl);
      } catch (e) {
        results.errors.push("Could not get ACR URL: " + e.message);
      }
    } else {
      results.accessControlType = "WAC";
      results.wacSupported = true;
      console.log("[Diagnostics] Container uses WAC (Web Access Control)");
    }

    // Check public access (works for both WAC and ACP with universalAccess)
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
 * Alternative: Try using ACP for public access
 * iGrant.io might use ACP instead of WAC
 */
export async function makePublicUsingACP({ podUrl, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  try {
    const dataset = await getSolidDataset(containerUrl, { fetch });

    if (!acp_ess_2.hasAccessibleAcr(dataset)) {
      return {
        success: false,
        message: "Container does not support ACP",
      };
    }

    console.log("[ACP] Container supports ACP, attempting to set public access");

    // Get or create access control resource
    let acrDataset = await acp_ess_2.getAccessControlResource(dataset, { fetch });

    // Create a policy that allows public read
    const publicPolicy = acp_ess_2.createPolicy(acrDataset, "publicReadPolicy");

    // Set the policy to allow public (all agents) to read
    const updatedPolicy = acp_ess_2.setAllowModes(publicPolicy, {
      read: true,
      write: false,
      append: false,
    });

    // Apply the policy to everyone
    const policyWithPublic = acp_ess_2.setPublic(updatedPolicy);

    // Save the policy
    acrDataset = acp_ess_2.setPolicy(acrDataset, policyWithPublic);

    // Save the ACR
    const savedAcr = await acp_ess_2.saveAccessControlResource(acrDataset, { fetch });

    console.log("[ACP] Successfully set public access using ACP");

    return {
      success: true,
      message: "Public access set using ACP",
    };
  } catch (e) {
    console.error("[ACP] Error setting public access:", e);
    return {
      success: false,
      message: "Failed to set public access using ACP: " + e.message,
      error: e,
    };
  }
}
