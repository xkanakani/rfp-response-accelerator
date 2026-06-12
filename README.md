# RFP Response Accelerator

A static browser app for proposal teams to analyze RFP text, classify requirements, estimate solution fit, identify risks, and generate response drafts through an OpenAI-compatible OCI Generative AI endpoint.

## Features

- Paste or load sample RFP text
- Configure deal type, model, endpoint, and proposal context
- Generate requirement classification, fit scoring, risks, win themes, and response drafts
- Export analysis results as Markdown
- Runs as plain HTML, CSS, and JavaScript

## Security Notes

- API tokens are entered in the browser and sent directly to the configured endpoint.
- Tokens are not persisted in `localStorage`; only non-secret settings such as model, endpoint, and context can be remembered.
- Do not paste customer-confidential RFP text into an endpoint unless that use is approved for your environment.

## Usage

Open `index.html` in a browser, or serve the folder locally:

```sh
python3 -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

Enter your API token in the settings panel before running an analysis.
