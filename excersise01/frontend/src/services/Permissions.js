// src/services/Permissions.js
// Enhanced version with better documentation and error handling

import {
  universalAccess,
  getSolidDataset,
  getContainedResourceUrlAll,
} from "@inrupt/solid-client";

/**
 * ASSIGNMENT: Web Access Control (WAC) Implementation
 * This file implements proper resource authorization for Solid Pods
 * using the universalAccess API (successor to ACL API)
 */

function rootPodUrl(podUrl) {
  let b = (podUrl || "").trim().replace(/\/+$/, "");
  b = b.replace(/\/(public|private)(\/.*)?$/i, "");
  return b;
}

/**
 * Handle WebID variations (with/without #me fragment)
 * Some Solid servers use #me, some don't - we grant to both
 */
function agentVariants(webId) {
  const n = (webId || "").trim().replace(/\/+$/, "");
  if (!n) return [];
  if (n.includes("#")) {
    const noFrag = n.split("#")[0];
    return [n, noFrag];
  }
  return [n, n + "#me"];
}

/**
 * Grant read access to /private/fitness/ for a friend
 * This is the PROPER WAC implementation as required by the assignment
 * 
 * @param {Object} params
 * @param {string} params.podUrl - Your Pod URL
 * @param {string} params.friendWebId - Friend's WebID to grant access to
 * @param {Function} params.fetch - Authenticated fetch function
 * @returns {Promise<Object>} Result object with success status
 */
export async function grantFitnessReadToFriend({ podUrl, friendWebId, fetch }) {
  console.log("\n🔐 [WAC] Granting fitness read access...");
  console.log("   Pod:", podUrl);
  console.log("   Friend:", friendWebId);

  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;
  const agents = agentVariants(friendWebId);

  console.log("   Agent variants:", agents);

  try {
    // 1) Grant access to the container itself
    console.log("   Step 1: Sharing container...");
    for (const agent of agents) {
      await universalAccess.setAgentAccess(
        containerUrl,
        agent,
        { read: true, write: false, append: false, control: false },
        { fetch }
      );
    }
    console.log("   ✓ Container access granted");

    // 2) Grant access to all existing files inside (index.ttl + activity files)
    console.log("   Step 2: Sharing contained files...");
    try {
      const containerDs = await getSolidDataset(containerUrl, { fetch });
      const contained = getContainedResourceUrlAll(containerDs);

      console.log(`   Found ${contained.length} files to share:`, contained);

      for (const fileUrl of contained) {
        for (const agent of agents) {
          await universalAccess.setAgentAccess(
            fileUrl,
            agent,
            { read: true, write: false, append: false, control: false },
            { fetch }
          );
        }
      }

      console.log(`   ✓ All ${contained.length} files shared`);
    } catch (e) {
      console.warn(
        "   ⚠️  Could not list/share contained files. " +
        "Container is shared, but existing files might not be accessible. Error:",
        e.message
      );
    }

    console.log("✓ [WAC] Fitness read access granted successfully\n");
    return {
      success: true,
      containerUrl,
      agents,
      message: "Read access granted to private fitness data"
    };

  } catch (error) {
    console.error("✗ [WAC] Failed to grant fitness read access:", error);
    return {
      success: false,
      error: error.message,
      containerUrl,
      agents
    };
  }
}

/**
 * Revoke access from a friend
 * @param {Object} params
 * @param {string} params.podUrl - Your Pod URL
 * @param {string} params.friendWebId - Friend's WebID to revoke access from
 * @param {Function} params.fetch - Authenticated fetch function
 * @returns {Promise<Object>} Result object with success status
 */
export async function revokeFitnessAccessFromFriend({ podUrl, friendWebId, fetch }) {
  console.log("\n🔒 [WAC] Revoking fitness access...");
  console.log("   Pod:", podUrl);
  console.log("   Friend:", friendWebId);

  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;
  const agents = agentVariants(friendWebId);

  try {
    // Revoke container access
    for (const agent of agents) {
      await universalAccess.setAgentAccess(
        containerUrl,
        agent,
        { read: false, write: false, append: false, control: false },
        { fetch }
      );
    }

    // Revoke access to contained files
    try {
      const containerDs = await getSolidDataset(containerUrl, { fetch });
      const contained = getContainedResourceUrlAll(containerDs);

      for (const fileUrl of contained) {
        for (const agent of agents) {
          await universalAccess.setAgentAccess(
            fileUrl,
            agent,
            { read: false, write: false, append: false, control: false },
            { fetch }
          );
        }
      }
    } catch (e) {
      console.warn("   ⚠️  Could not revoke from contained files:", e.message);
    }

    console.log("✓ [WAC] Access revoked successfully\n");
    return { success: true, message: "Access revoked" };

  } catch (error) {
    console.error("✗ [WAC] Failed to revoke access:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Check what access a specific agent has to your fitness data
 * @param {Object} params
 * @param {string} params.podUrl - Your Pod URL
 * @param {string} params.agentWebId - Agent's WebID to check
 * @param {Function} params.fetch - Authenticated fetch function
 * @returns {Promise<Object>} Access permissions object
 */
export async function checkAgentAccess({ podUrl, agentWebId, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;
  const agents = agentVariants(agentWebId);

  console.log("\n🔍 [WAC] Checking access for:", agentWebId);

  try {
    // Check first agent variant
    const access = await universalAccess.getAgentAccess(
      containerUrl,
      agents[0],
      { fetch }
    );

    console.log("   Access permissions:", access);
    return access;

  } catch (error) {
    console.error("   Error checking access:", error);
    return null;
  }
}

/**
 * Check public access to fitness data
 * @param {Object} params
 * @param {string} params.podUrl - Your Pod URL
 * @param {Function} params.fetch - Authenticated fetch function
 * @returns {Promise<Object>} Public access permissions
 */
export async function checkPublicAccess({ podUrl, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  console.log("\n🌐 [WAC] Checking public access to:", containerUrl);

  try {
    const access = await universalAccess.getPublicAccess(containerUrl, { fetch });
    console.log("   Public access:", access);
    return access;

  } catch (error) {
    console.error("   Error checking public access:", error);
    return null;
  }
}

/**
 * Display comprehensive access summary for fitness data
 * Useful for debugging and verifying permissions
 */
export async function displayFitnessAccessSummary({ podUrl, webId, fetch }) {
  const root = rootPodUrl(podUrl);
  const containerUrl = `${root}/private/fitness/`;

  console.log("\n" + "=".repeat(60));
  console.log("FITNESS DATA ACCESS SUMMARY");
  console.log("=".repeat(60));
  console.log(`Pod: ${podUrl}`);
  console.log(`Owner: ${webId}`);
  console.log(`Container: ${containerUrl}`);
  console.log("-".repeat(60));

  // Check public access
  const publicAccess = await checkPublicAccess({ podUrl, fetch });
  console.log("\n📢 PUBLIC ACCESS:");
  console.log(publicAccess || "   None");

  // Check owner access
  console.log("\n👤 OWNER ACCESS:");
  const ownerAccess = await checkAgentAccess({ podUrl, agentWebId: webId, fetch });
  console.log(ownerAccess || "   Error checking");

  // List all files in container
  console.log("\n📁 CONTAINED FILES:");
  try {
    const containerDs = await getSolidDataset(containerUrl, { fetch });
    const contained = getContainedResourceUrlAll(containerDs);
    contained.forEach(url => {
      console.log(`   - ${url.split('/').pop()}`);
    });
  } catch (e) {
    console.log("   Error listing files:", e.message);
  }

  console.log("\n" + "=".repeat(60) + "\n");
}

/**
 * Grant read access to multiple friends at once
 * @param {Object} params
 * @param {string} params.podUrl - Your Pod URL
 * @param {Array<string>} params.friendWebIds - Array of friend WebIDs
 * @param {Function} params.fetch - Authenticated fetch function
 * @returns {Promise<Object>} Results object
 */
export async function grantFitnessReadToMultipleFriends({ podUrl, friendWebIds, fetch }) {
  console.log(`\n🔐 [WAC] Granting access to ${friendWebIds.length} friends...`);

  const results = {
    successful: [],
    failed: []
  };

  for (const friendWebId of friendWebIds) {
    const result = await grantFitnessReadToFriend({ podUrl, friendWebId, fetch });
    
    if (result.success) {
      results.successful.push(friendWebId);
    } else {
      results.failed.push({ webId: friendWebId, error: result.error });
    }
  }

  console.log(`\n✓ Granted to ${results.successful.length} friends`);
  if (results.failed.length > 0) {
    console.log(`✗ Failed for ${results.failed.length} friends`);
  }

  return results;
}

export default {
  grantFitnessReadToFriend,
  revokeFitnessAccessFromFriend,
  checkAgentAccess,
  checkPublicAccess,
  displayFitnessAccessSummary,
  grantFitnessReadToMultipleFriends
};