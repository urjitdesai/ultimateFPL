import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { env } from "../src/config/env.js";
import { firestore } from "../src/firebase/admin.js";

const outputDirectory = fileURLToPath(
  new URL("../../frontend/public/team-logos/", import.meta.url),
);

async function downloadTeamLogos() {
  const snapshot = await firestore.collection("teams").where("isActive", "==", true).get();
  await mkdir(outputDirectory, { recursive: true });

  for (const document of snapshot.docs) {
    const providerTeamId = document.data().providerTeamId as number | undefined;
    if (!providerTeamId) continue;

    const teamResponse = await fetch(
      `${env.BACKEND_API.replace(/\/$/, "")}/teams/${providerTeamId}`,
      { headers: { authorization: `Bearer ${env.BACKEND_API_TOKEN}` } },
    );
    if (!teamResponse.ok) throw new Error(`Could not load team ${document.id}.`);

    const teamPayload = await teamResponse.json() as { data?: { team_logo?: string } };
    const sourceUrl = teamPayload.data?.team_logo;
    if (!sourceUrl) continue;

    const parsedUrl = new URL(sourceUrl);
    if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "footballdata.io") {
      throw new Error(`Refusing unexpected logo host for ${document.id}.`);
    }

    const response = await fetch(parsedUrl);
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
      throw new Error(`Could not download the logo for ${document.id}.`);
    }

    const destination = path.join(outputDirectory, `${document.id}.png`);
    await writeFile(destination, Buffer.from(await response.arrayBuffer()));
  }

  console.log(`Saved ${snapshot.size} team logos to ${outputDirectory}`);
}

await downloadTeamLogos();
