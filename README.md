# Markdown Publish

## Description

This plugin allows you to publish your notes to Dev.to directly from Obsidian.md. Additionally, you can generate Markdown or HTML content to publish on your site of choice.

## TOC

- [Features](#features)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)

## Features

- Publish notes to Dev.to
- Generate Markdown content
- Generate HTML content
- Uploading local images to Imgur

## Installation

1. Download the latest release [here](https://github.com/KorieLochten/markdown-publish/releases).
2. Place the plugin files in your Obsidian plugins directory.
3. Enable the plugin in Obsidian settings.

## Usage

1. Open a note in Obsidian.
2. Click the `Publish Blog` button in the ribbon.
3. If needed to publish, you can select Dev.to or just continue without.
4. Fill in the required fields (title, tags, etc.).
5. Click "Publish" to publish your note or "Generate" to create Markdown/HTML content.

## Configuration

### Dev.to Configuration

1. Visit https://dev.to/settings/extensions
2. In the "DEV API Keys" section create a new key by adding a description and clicking on "Generate API Key"
3. You'll see the newly generated key in the same view

### Imgur Configuration

1. Visit https://api.imgur.com/oauth2/addclient
2. Fill in the required fields and click "Submit"
3. You'll see the client ID and client secret in the same view
4. Copy the client ID and add it to the plugin settings
