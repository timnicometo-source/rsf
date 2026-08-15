# Rochester Sports Foundation News Editor Framework

This framework keeps the public website as plain HTML, CSS, and JavaScript while
allowing article content to be managed through Pages CMS after the website is
connected to GitHub.

## What is included

- `.pages.yml` defines the future browser-based editing form.
- `content/news/` stores one structured JSON file per article.
- `scripts/build-news.mjs` converts published article records into static HTML.
- `assets/data/news.json` is generated for the News archive and homepage cards.
- `.github/workflows/build-news.yml` automates page generation after GitHub is connected.
- `Build News.command` provides an optional local double-click builder on a Mac.

## Article controls

Editors can manage:

- title, subtitle, summary, date, author, category, article type, and status;
- featured and sharing images;
- draft or published status;
- create, edit, rename, and delete actions;
- flexible article sections that can be added and reordered.

## Available article sections

- Text
- Section heading
- Image with caption
- Pull quote
- Statistics or impact callout
- Photo with its own separate text
- Photo gallery
- Highlighted message and optional button
- PDF document download

## Local use

Open the project through Live Server, then visit:

```text
http://127.0.0.1:5500/admin/news-editor.html
```

Use **Connect site folder** and select the main Rochester Sports Foundation
project folder. The editor can create, edit, delete, and save article records,
and it copies selected article images into the appropriate site folder.

After saving an article, double-click `Build News.command`. This generates the
public article HTML and updates the News index. The included grant article is
already generated and can be viewed without rebuilding.

If article JSON is changed locally and Node is installed, double-click
`Build News.command`, or run:

```text
node scripts/build-news.mjs
```

Then review the article through Live Server.

## GitHub and Pages CMS

Pages CMS is not activated yet. After the website is placed in GitHub:

1. Install or connect Pages CMS to the repository.
2. Pages CMS reads `.pages.yml` and displays the News Articles editor.
3. An editor saves an article.
4. The article JSON and uploaded images are stored in GitHub.
5. The included workflow generates the public HTML and News index automatically.
6. Hostinger can deploy the resulting static files.

The public website remains ordinary static files throughout this process.
