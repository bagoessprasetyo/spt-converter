{
  "name": "PDF to Excel Converter - Fixed",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "pdf-converter",
        "authentication": "headerAuth",
        "responseMode": "responseNode",
        "options": {}
      },
      "id": "655c4eae-34ec-43c3-ae59-b425fef81eed",
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 1,
      "position": [-880, 64],
      "webhookId": "edb6b06b-3da7-45f1-b8e1-5a36b9285c72",
      "credentials": {
        "httpHeaderAuth": {
          "id": "VlpmBhZiu55gPOJs",
          "name": "Header Auth account 2"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const items = [];\nconst webhookData = $input.all();\n\nconsole.log('=== EXTRACT FILE DATA DEBUG ===');\nconsole.log('Input data keys:', Object.keys(webhookData[0]?.json || {}));\n\nfor (const item of webhookData) {\n  console.log('Processing item body:', Object.keys(item.json?.body || {}));\n  \n  // Handle the new JSON structure with fileData in body\n  if (item.json && item.json.body && item.json.body.fileData) {\n    console.log('Found fileData in body');\n    const body = item.json.body;\n    \n    const processedItem = {\n      json: {\n        fileName: body.fileName || 'uploaded.pdf',\n        mimeType: 'application/pdf',\n        fileSize: body.fileSize || 0,\n        uploadTime: new Date().toISOString(),\n        processId: Math.random().toString(36).substr(2, 9),\n        inputType: 'body_fileData',\n        conversionId: body.conversionId,\n        userId: body.userId\n      },\n      binary: {\n        data: {\n          data: body.fileData,\n          mimeType: 'application/pdf',\n          fileName: body.fileName || 'uploaded.pdf',\n          fileSize: body.fileSize || 0\n        }\n      }\n    };\n    \n    console.log('Created processed item with fileData');\n    items.push(processedItem);\n  }\n  // Handle old JSON structure with file\n  else if (item.json && item.json.file) {\n    console.log('Found JSON payload with file data');\n    const processedItem = {\n      json: {\n        fileName: item.json.fileName || 'uploaded.pdf',\n        mimeType: item.json.mimeType || 'application/pdf',\n        fileSize: item.json.fileSize || 0,\n        uploadTime: new Date().toISOString(),\n        processId: Math.random().toString(36).substr(2, 9),\n        inputType: 'json_base64'\n      },\n      binary: {\n        data: {\n          data: item.json.file,\n          mimeType: item.json.mimeType || 'application/pdf',\n          fileName: item.json.fileName || 'uploaded.pdf',\n          fileSize: item.json.fileSize || 0\n        }\n      }\n    };\n    \n    console.log('Created processed item with file');\n    items.push(processedItem);\n  }\n  // Handle FormData uploads (fallback)\n  else if (item.binary && item.binary.data) {\n    console.log('Found binary data upload');\n    items.push({\n      json: {\n        fileName: item.binary.data.fileName || 'uploaded.pdf',\n        mimeType: item.binary.data.mimeType,\n        fileSize: item.binary.data.fileSize,\n        uploadTime: new Date().toISOString(),\n        processId: Math.random().toString(36).substr(2, 9),\n        inputType: 'form_data'\n      },\n      binary: {\n        data: item.binary.data\n      }\n    });\n  }\n  else {\n    console.log('No valid file data found in item');\n    console.log('Available keys:', Object.keys(item.json || {}));\n    items.push({\n      json: {\n        error: 'No file data found',\n        inputType: 'unknown',\n        availableKeys: Object.keys(item.json || {}),\n        bodyKeys: Object.keys(item.json?.body || {})\n      }\n    });\n  }\n}\n\nconsole.log('Extract File Data Output:', items.length, 'items');\nreturn items;"
      },
      "id": "c1f998a4-12da-475b-9798-54528fa0b492",
      "name": "Extract File Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-656, 64]
    },
    {
      "parameters": {
        "jsCode": "const items = [];\n\nfor (const item of $input.all()) {\n  console.log('=== SIMPLE VALIDATION TEST ===');\n  console.log('Raw input item:', JSON.stringify(item, null, 2));\n  \n  // Check what data we actually have\n  const hasJsonData = !!item.json;\n  const hasBinaryData = !!(item.binary && item.binary.data);\n  const hasFileInJson = !!(item.json && item.json.file);\n  \n  console.log('Data checks:', {\n    hasJsonData,\n    hasBinaryData, \n    hasFileInJson,\n    fileName: item.json?.fileName,\n    fileSize: item.json?.fileSize,\n    mimeType: item.json?.mimeType\n  });\n  \n  // Simple validation - just check if we have a file\n  let isValid = false;\n  let errorMessage = '';\n  \n  if (!hasJsonData) {\n    errorMessage = 'No JSON data found';\n  } else if (!item.json.fileName) {\n    errorMessage = 'No filename provided';\n  } else if (!item.json.fileName.toLowerCase().endsWith('.pdf')) {\n    errorMessage = 'File is not a PDF';\n  } else if (!item.json.fileSize || item.json.fileSize <= 0) {\n    errorMessage = 'File has no size';\n  } else if (!hasBinaryData || !item.binary.data.data) {\n    errorMessage = 'No binary data found';\n  } else {\n    isValid = true;\n    errorMessage = 'File is valid';\n  }\n  \n  const result = {\n    json: {\n      ...item.json,\n      status: isValid ? 'valid' : 'invalid',\n      validationError: errorMessage,\n      debugInfo: {\n        hasJsonData,\n        hasBinaryData,\n        hasFileInJson,\n        fileNameCheck: item.json?.fileName,\n        fileSizeCheck: item.json?.fileSize\n      }\n    },\n    binary: item.binary\n  };\n  \n  console.log('Validation result:', {\n    status: result.json.status,\n    error: errorMessage,\n    isValid\n  });\n  \n  items.push(result);\n}\n\nreturn items;"
      },
      "id": "9881a796-ee4c-4b6c-b0e7-59f003048ec3",
      "name": "File Validation",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [-448, 64]
    },
    {
      "parameters": {
        "conditions": {
          "options": {
            "caseSensitive": true,
            "leftValue": "",
            "typeValidation": "strict",
            "version": 1
          },
          "conditions": [
            {
              "id": "validation-check",
              "leftValue": "={{ $json.status }}",
              "rightValue": "valid",
              "operator": {
                "type": "string",
                "operation": "equals"
              }
            }
          ],
          "combinator": "and"
        },
        "options": {}
      },
      "id": "98ccfcc2-ec8c-4864-b452-aabeafa02386",
      "name": "Validation Filter",
      "type": "n8n-nodes-base.if",
      "typeVersion": 2,
      "position": [-224, 64]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.openai.com/v1/chat/completions",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "openAiApi",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [
            {
              "name": "Content-Type",
              "value": "application/json"
            }
          ]
        },
        "sendBody": true,
        "bodyParameters": {
          "parameters": [
            {
              "name": "model",
              "value": "gpt-4o"
            },
            {
              "name": "messages",
              "value": "={{ [\n  {\n    \"role\": \"user\",\n    \"content\": [\n      {\n        \"type\": \"text\",\n        \"text\": \"Analyze this PDF document and extract all tabular data. Instructions:\\n1. Identify all tables and structured data\\n2. Extract headers, column names, and all data rows\\n3. Maintain data relationships and structure\\n4. Return data in this JSON format:\\n{\\n  \\\"tables\\\": [\\n    {\\n      \\\"title\\\": \\\"Table Name\\\",\\n      \\\"headers\\\": [\\\"Column1\\\", \\\"Column2\\\"],\\n      \\\"rows\\\": [\\n        [\\\"value1\\\", \\\"value2\\\"],\\n        [\\\"value3\\\", \\\"value4\\\"]\\n      ]\\n    }\\n  ]\\n}\\nReturn ONLY the JSON response.\"\n      },\n      {\n        \"type\": \"image_url\",\n        \"image_url\": {\n          \"url\": \"data:application/pdf;base64,\" + $node['File Validation'].binary.data.data\n        }\n      }\n    ]\n  }\n] }}"
            },
            {
              "name": "max_tokens",
              "value": 4000
            },
            {
              "name": "temperature",
              "value": 0.1
            }
          ]
        },
        "options": {
          "response": {
            "response": {
              "responseFormat": "json"
            }
          }
        }
      },
      "id": "74b552bf-ac11-4124-bf93-37c6dc938172",
      "name": "OpenAI Vision Analysis",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [0, 0],
      "credentials": {
        "openAiApi": {
          "id": "j3dv6IcGCdpa6bFe",
          "name": "OpenAi account"
        }
      }
    },
    {
      "parameters": {
        "jsCode": "const items = [];\n\nfor (const item of $input.all()) {\n  try {\n    let extractedData;\n    let aiResponse = item.json.choices?.[0]?.message?.content || item.json.message || item.json.text;\n    \n    if (typeof aiResponse === 'string') {\n      aiResponse = aiResponse.replace(/```json\\n?/g, '').replace(/```\\n?/g, '').trim();\n      extractedData = JSON.parse(aiResponse);\n    } else {\n      extractedData = aiResponse;\n    }\n    \n    if (extractedData && extractedData.tables && Array.isArray(extractedData.tables)) {\n      const totalDataRows = extractedData.tables.reduce((sum, table) => {\n        return sum + (table.rows ? table.rows.length : 0);\n      }, 0);\n      \n      items.push({\n        json: {\n          ...item.json,\n          extractedData,\n          tableCount: extractedData.tables.length,\n          totalDataRows,\n          status: 'parsed_successfully'\n        },\n        binary: item.binary\n      });\n    } else {\n      throw new Error('Invalid data structure from AI');\n    }\n    \n  } catch (error) {\n    items.push({\n      json: {\n        ...item.json,\n        status: 'parsing_failed',\n        error: error.message,\n        rawResponse: item.json.choices?.[0]?.message?.content || item.json.message\n      },\n      binary: item.binary\n    });\n  }\n}\n\nreturn items;"
      },
      "id": "a1a8692e-0d8b-49c9-8c04-92ac2ce70a9d",
      "name": "Parse AI Response",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [224, 0]
    },
    {
      "parameters": {
        "jsCode": "const items = [];\n\nfor (const item of $input.all()) {\n  if (item.json.status !== 'parsed_successfully') {\n    items.push(item);\n    continue;\n  }\n  \n  const extractedData = item.json.extractedData;\n  const excelData = [];\n  \n  excelData.push([`Converted from: ${item.json.fileName}`]);\n  excelData.push([`Conversion Date: ${new Date().toLocaleDateString()}`]);\n  excelData.push([]);\n  \n  extractedData.tables.forEach((table, tableIndex) => {\n    const tableTitle = table.title || `Table ${tableIndex + 1}`;\n    excelData.push([tableTitle]);\n    excelData.push([]);\n    \n    if (table.headers && table.headers.length > 0) {\n      excelData.push(table.headers);\n    }\n    \n    if (table.rows && table.rows.length > 0) {\n      table.rows.forEach(row => {\n        const processedRow = Array.isArray(row) ? row.map(cell => {\n          if (cell === null || cell === undefined) return '';\n          if (typeof cell === 'object') return JSON.stringify(cell);\n          return String(cell);\n        }) : [String(row)];\n        \n        excelData.push(processedRow);\n      });\n    }\n    \n    excelData.push([]);\n    excelData.push([]);\n  });\n  \n  items.push({\n    json: {\n      ...item.json,\n      excelData,\n      rowCount: excelData.length,\n      status: 'excel_ready'\n    },\n    binary: item.binary\n  });\n}\n\nreturn items;"
      },
      "id": "4ede3d2e-e73c-4538-af36-39193cad2611",
      "name": "Generate Excel Data",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [448, 0]
    },
    {
      "parameters": {
        "operation": "create",
        "title": "={{$json.fileName.replace('.pdf', '')}}_converted_{{$now.format('YYYY-MM-DD_HH-mm-ss')}}",
        "sheetsUi": {
          "sheetValues": [
            {
              "sheetName": "Converted Data",
              "headerRow": false
            }
          ]
        },
        "options": {}
      },
      "id": "7603676a-2ecc-4772-b8df-5d4be93df42d",
      "name": "Create Google Sheet",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4,
      "position": [672, 0],
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "3ChoBBFNSFdgjFiC",
          "name": "Google Sheets account"
        }
      }
    },
    {
      "parameters": {
        "operation": "appendOrUpdate",
        "documentId": "={{$node['Create Google Sheet'].json.spreadsheetId}}",
        "sheetName": "Converted Data",
        "columnToMatchOn": "A",
        "dataMode": "define",
        "fieldsUi": {
          "fieldValues": [
            {
              "fieldId": "A1:ZZ1000",
              "fieldValue": "={{$node['Generate Excel Data'].json.excelData}}"
            }
          ]
        },
        "options": {
          "valueInputMode": "RAW"
        }
      },
      "id": "31c858a3-a916-416a-9d90-2a283ab651d1",
      "name": "Populate Sheet Data",
      "type": "n8n-nodes-base.googleSheets",
      "typeVersion": 4,
      "position": [880, 0],
      "credentials": {
        "googleSheetsOAuth2Api": {
          "id": "3ChoBBFNSFdgjFiC",
          "name": "Google Sheets account"
        }
      }
    },
    {
      "parameters": {
        "url": "=https://docs.google.com/spreadsheets/d/{{$node['Create Google Sheet'].json.spreadsheetId}}/export?format=xlsx",
        "options": {
          "response": {
            "response": {
              "responseFormat": "file"
            }
          }
        }
      },
      "id": "1125eee6-2247-42d6-87ac-b25bb15a94aa",
      "name": "Convert to Excel",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.1,
      "position": [1104, 0]
    },
    {
      "parameters": {
        "jsCode": "const items = [];\n\nfor (const item of $input.all()) {\n  const excelFile = item.binary.data;\n  const originalFileName = $node['Extract File Data'].json.fileName || 'document.pdf';\n  const baseFileName = originalFileName.replace(/\\.pdf$/i, '');\n  const excelFileName = `${baseFileName}_converted.xlsx`;\n  \n  const downloadId = Math.random().toString(36).substr(2, 12);\n  const downloadUrl = `${$webhook.getUrl()}download/${downloadId}`;\n  \n  items.push({\n    json: {\n      downloadId,\n      downloadUrl,\n      fileName: excelFileName,\n      originalFile: originalFileName,\n      status: 'ready_for_download',\n      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),\n      googleSheetId: $node['Create Google Sheet'].json.spreadsheetId,\n      googleSheetUrl: $node['Create Google Sheet'].json.spreadsheetUrl\n    },\n    binary: {\n      data: {\n        ...excelFile,\n        fileName: excelFileName\n      }\n    }\n  });\n}\n\nreturn items;"
      },
      "id": "bdeb13d0-415c-405d-8e89-82e172a301cf",
      "name": "Generate Download Link",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1328, 0]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={\n  \"success\": true,\n  \"message\": \"PDF converted successfully to Excel\",\n  \"data\": {\n    \"downloadUrl\": \"{{$json.downloadUrl}}\",\n    \"fileName\": \"{{$json.fileName}}\",\n    \"originalFile\": \"{{$json.originalFile}}\",\n    \"expiresAt\": \"{{$json.expiresAt}}\",\n    \"googleSheetUrl\": \"{{$json.googleSheetUrl}}\"\n  }\n}",
        "options": {}
      },
      "id": "6347ce60-1421-4bd9-a95b-eff4f8e15ff5",
      "name": "Send Success Response",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [1552, 0]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={\n  \"success\": false,\n  \"error\": \"{{$json.error || 'File validation failed'}}\",\n  \"message\": \"Unable to process PDF. Please check file format and try again.\",\n  \"details\": {\n    \"fileName\": \"{{$json.fileName}}\",\n    \"validations\": {{$json.validations}}\n  }\n}",
        "options": {
          "responseCode": 400
        }
      },
      "id": "e7ff0e7b-b943-4615-a991-dd4c28c33521",
      "name": "Send Validation Error",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [0, 128]
    },
    {
      "parameters": {
        "respondWith": "json",
        "responseBody": "={\n  \"success\": false,\n  \"error\": \"{{$json.error || 'Processing failed'}}\",\n  \"message\": \"Unable to convert PDF. The document may be too complex or corrupted.\",\n  \"details\": {\n    \"fileName\": \"{{$json.fileName}}\",\n    \"status\": \"{{$json.status}}\",\n    \"processId\": \"{{$json.processId}}\"\n  }\n}",
        "options": {
          "responseCode": 500
        }
      },
      "id": "860baaae-3b09-4d40-8cec-56a4c482826c",
      "name": "Send Processing Error",
      "type": "n8n-nodes-base.respondToWebhook",
      "typeVersion": 1,
      "position": [448, 128]
    }
  ],
  "pinData": {},
  "connections": {
    "Webhook Trigger": {
      "main": [
        [
          {
            "node": "Extract File Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Extract File Data": {
      "main": [
        [
          {
            "node": "File Validation",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "File Validation": {
      "main": [
        [
          {
            "node": "Validation Filter",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Validation Filter": {
      "main": [
        [
          {
            "node": "OpenAI Vision Analysis",
            "type": "main",
            "index": 0
          }
        ],
        [
          {
            "node": "Send Validation Error",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "OpenAI Vision Analysis": {
      "main": [
        [
          {
            "node": "Parse AI Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Parse AI Response": {
      "main": [
        [
          {
            "node": "Generate Excel Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Generate Excel Data": {
      "main": [
        [
          {
            "node": "Create Google Sheet",
            "type": "main",
            "index": 0
          },
          {
            "node": "Send Processing Error",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Create Google Sheet": {
      "main": [
        [
          {
            "node": "Populate Sheet Data",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Populate Sheet Data": {
      "main": [
        [
          {
            "node": "Convert to Excel",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Convert to Excel": {
      "main": [
        [
          {
            "node": "Generate Download Link",
            "type": "main",
            "index": 0
          }
        ]
      ]
    },
    "Generate Download Link": {
      "main": [
        [
          {
            "node": "Send Success Response",
            "type": "main",
            "index": 0
          }
        ]
      ]
    }
  },
  "active": true,
  "settings": {
    "executionOrder": "v1"
  },
  "versionId": "complete-fixed-version",
  "meta": {
    "templateCredsSetupCompleted": true,
    "instanceId": "17844ef145620b68fa6aebf481fdac0b65a52ae617eabbbee476fc9b6a2cc114"
  },
  "id": "FkE3WXCSnggXOzPO",
  "tags": [
    {
      "createdAt": "2025-08-22T10:08:33.085Z",
      "updatedAt": "2025-08-22T10:08:33.085Z",
      "id": "U8I0PaFzpzJd1eSz",
      "name": "PDF Converter"
    }
  ]
}