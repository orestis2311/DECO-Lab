// src/services/PublicAccessSetup.js
import {
  universalAccess,
  getSolidDataset,
  getContainedResourceUrlAll,
} from "@inrupt/solid-client";

/**
 * This service handles making relevant data PUBLIC for the assignment
 * Required to get full points: configure all relevant data as public
 */

function rootPodUrl(podUrl) {
  let b = (podUrl || "").trim().replace(/\/+$/, "");
  b = b.replace(/\/(public|private)(\/.*)?$/i, "");
  return b;
}

/**
 * Make /public/fitness/ directory and all its contents publicly readable
 * This is for assignment requirement: "configure all relevant data as public"
 */
export async function makePublicFitnessDataPublic({ podUrl, fetch }) {
  const root = rootPodUrl(podUrl);
  const publicFitnessUrl = `${root}/public/fitness/`;

  console.log("[PublicAccess] Making public fitness data accessible to everyone...");

  try {
    // 1) Make the public/fitness container itself public
    await universalAccess.setPublicAccess(
      publicFitnessUrl,
      { read: true, write: false, append: false, control: false },
      { fetch }
    );

    console.log(`✓ Public container ${publicFitnessUrl} is now publicly readable`);

    // 2) Make all files inside public too (friends.ttl, etc.)
    try {
      const containerDs = await getSolidDataset(publicFitnessUrl, { fetch });
      const contained = getContainedResourceUrlAll(containerDs);

      console.log(`[PublicAccess] Found ${contained.length} files to make public:`, contained);

      for (const fileUrl of contained) {
        await universalAccess.setPublicAccess(
          fileUrl,
          { read: true, write: false, append: false, control: false },
          { fetch }
        );
        console.log(`✓ Made public: ${fileUrl}`);
      }

      console.log(`✓ All ${contained.length} files in public/fitness/ are now public`);
    } catch (e) {
      console.warn("[PublicAccess] Could not list contained files:", e);
    }

    return { success: true, url: publicFitnessUrl };
  } catch (error) {
    console.error("[PublicAccess] Error making public fitness data public:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Make the profile publicly readable (usually already public, but let's ensure it)
 */
export async function makeProfilePublic({ webId, fetch }) {
  console.log("[PublicAccess] Making profile publicly readable...");

  try {
    await universalAccess.setPublicAccess(
      webId,
      { read: true, write: false, append: false, control: false },
      { fetch }
    );

    console.log(`✓ Profile ${webId} is now publicly readable`);
    return { success: true, url: webId };
  } catch (error) {
    console.error("[PublicAccess] Error making profile public:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Verify public access to a resource
 */
export async function verifyPublicAccess({ resourceUrl, fetch }) {
  try {
    const access = await universalAccess.getPublicAccess(resourceUrl, { fetch });
    console.log(`[PublicAccess] Public access for ${resourceUrl}:`, access);
    return access;
  } catch (error) {
    console.error(`[PublicAccess] Error checking public access for ${resourceUrl}:`, error);
    return null;
  }
}

/**
 * Main function to configure all relevant data as public
 * Call this after login to satisfy assignment requirements
 */
export async function configureAllPublicData({ podUrl, webId, fetch }) {
  console.log("\n=== CONFIGURING PUBLIC ACCESS (Assignment Requirement) ===");

  const results = [];

  // 1. Make public/fitness directory public
  const publicFitnessResult = await makePublicFitnessDataPublic({ podUrl, fetch });
  results.push({
    resource: "public/fitness/",
    ...publicFitnessResult
  });

  // 2. Make profile public
  const profileResult = await makeProfilePublic({ webId, fetch });
  results.push({
    resource: "profile",
    ...profileResult
  });

  // Summary
  console.log("\n=== PUBLIC ACCESS CONFIGURATION SUMMARY ===");
  console.log(`Total resources configured: ${results.length}`);
  console.log(`Successful: ${results.filter(r => r.success).length}`);
  console.log(`Failed: ${results.filter(r => !r.success).length}`);

  results.forEach(result => {
    const status = result.success ? "✓" : "✗";
    console.log(`${status} ${result.resource}: ${result.success ? "Public" : result.error}`);
  });

  console.log("=========================================\n");

  return results;
}

/**
 * Display access summary for debugging/verification
 */
export async function displayAccessSummary({ podUrl, webId, fetch }) {
  const root = rootPodUrl(podUrl);

  console.log("\n=== ACCESS SUMMARY ===");

  // Check public/fitness/
  const publicFitnessUrl = `${root}/public/fitness/`;
  const publicFitnessAccess = await verifyPublicAccess({
    resourceUrl: publicFitnessUrl,
    fetch
  });
  console.log(`\n📁 ${publicFitnessUrl}`);
  console.log(`   Public Access:`, publicFitnessAccess);

  // Check profile
  const profileAccess = await verifyPublicAccess({
    resourceUrl: webId,
    fetch
  });
  console.log(`\n👤 ${webId}`);
  console.log(`   Public Access:`, profileAccess);

  console.log("\n======================\n");
}