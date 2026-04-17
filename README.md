# Strapi Auto Slug

A custom field plugin for Strapi v5 that automatically generates URL-friendly slugs from any text field in your content types.

## Features

- **Real-time slug generation** — slugs are generated instantly as you type.
- **Source field selector** — pick which text field to generate the slug from using a dropdown.
- **Duplicate handling** — automatically appends `-1`, `-2`, etc. to ensure uniqueness
- **Configurable behavior** — control auto-generation rules per field via the Content-Type Builder
- **API fallback** — slugs are also generated server-side for entries created via the API
- **Unicode support** — handles diacritics and special characters gracefully

## Installation

```bash
npm install strapi-auto-slug
```

Add the plugin to your `config/plugins.js` (or `config/plugins.ts`):

```js
module.exports = {
  'auto-slug': {
    enabled: true,
  },
};
```

Rebuild your admin panel:

```bash
npm run build
```

## Usage

1. Open the **Content-Type Builder**
2. Add a new field and select the **Custom** tab
3. Choose **Auto Slug**
4. In the **Base settings**, select the **Source field** — a dropdown lists all available text/string fields in the content type
5. Configure behavior in the **Advanced settings** tab (see below)
6. Save the content type

When creating content, the slug field will automatically populate as you type in the source field.

## Advanced Settings

Each auto-slug field can be configured with the following options in the **Advanced settings** tab:

| Setting                                               | Default  | Description                                                                    |
| ----------------------------------------------------- | -------- | ------------------------------------------------------------------------------ |
| **Auto-generate slug on creation**                    | Enabled  | Generate the slug from the source field when creating a new entry              |
| **Stop auto-generation after manual edit**            | Enabled  | Stop syncing with the source field once the user manually edits the slug       |
| **Preserve slug when editing**                        | Enabled  | Keep the existing slug when editing an entry, even if the source field changes |
| **Auto-generate for empty slugs on existing entries** | Enabled  | Treat existing entries with an empty slug the same as new entries              |
| **Required field**                                    | Disabled | Prevent saving if the slug field is empty                                      |

## How It Works

### In the Admin Panel

- **New entry** — the slug auto-generates in real-time as you type in the source field
- **Manual override** — editing the slug directly stops auto-generation for that entry
- **Existing entry with a slug** — the slug is preserved and won't change even if the source field is modified
- **Existing entry with an empty slug** — behaves like a new entry and auto-generates from the source field

### On the Server (API)

When entries are created or updated via the REST or GraphQL API (without the admin panel):

- **Create** — if no slug is provided, one is generated from the source field
- **Create/Update** — if a slug is provided, it is checked for uniqueness and a suffix is appended if needed

## Slug Format

The slugify algorithm:

- Normalizes Unicode and strips diacritics (`café` → `cafe`)
- Converts to lowercase
- Replaces spaces and underscores with hyphens
- Removes all non-alphanumeric characters (except hyphens)
- Collapses consecutive hyphens
- Trims hyphens from the start and end

**Examples:**

| Input                    | Slug               |
| ------------------------ | ------------------ |
| `Hello World`            | `hello-world`      |
| `My Blog Post!`          | `my-blog-post`     |
| `Café & Résumé`          | `cafe-resume`      |
| `--Leading & Trailing--` | `leading-trailing` |
| `Multiple   Spaces`      | `multiple-spaces`  |

## Compatibility

- Strapi v5.x
- Node.js >= 18

## License

MIT
