import "dotenv/config";

import { put } from "@vercel/blob";
import bodyParser from "body-parser";
import express from "express";
import puppeteer from "puppeteer";
import { db } from "./lib/db";
import axios from "axios";

const app = express();

app.use(bodyParser.json());

app.post("/screenshot", async (req, res) => {
  const { projectId, versionNumber } = req.body;

  const project = await db
    .selectFrom("projects")
    .select("ownerUserId")
    .where("id", "=", projectId)
    .executeTakeFirst();

  if (!project) {
    res.status(404).json({});
    return;
  }

  const version = await db
    .selectFrom("projectVersions")
    .select("codeUrl")
    .where("projectId", "=", projectId)
    .where("number", "=", versionNumber)
    .executeTakeFirst();

  if (!version) {
    res.status(404).json({});
    return;
  }

  const codeRes = await axios(version.codeUrl);
  const dataUrl = "data:text/html;charset=utf-8," + escape(codeRes.data);

  const browser = await puppeteer.launch({
    headless: "new",
  });
  const page = await browser.newPage();
  await page.goto(dataUrl);

  await new Promise((res) => setTimeout(res, 1000));

  const screenshot = await page.screenshot({ type: "png" });

  const { url: imageUrl } = await put(
    `projects/${projectId}/versions/${versionNumber}/screenshot.png`,
    screenshot,
    {
      access: "public",
    }
  );

  await db
    .updateTable("projectVersions")
    .set({
      imageUrl,
    })
    .where("projectId", "=", projectId)
    .where("number", "=", versionNumber)
    .execute();

  await browser.close();

  res.status(200).json({});
});

app.listen(3000);
