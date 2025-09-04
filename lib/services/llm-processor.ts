import OpenAI from 'openai'
import { DocumentType } from '@/lib/supabase/types'
import { createClient } from '@/lib/supabase/server'
import pdf from 'pdf-parse'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

export interface ExtractedTable {
  title: string
  headers: string[]
  rows: string[][]
}

export interface ProcessingResult {
  success: boolean
  tables: ExtractedTable[]
  totalDataRows: number
  error?: string
  processingTimeMs: number
}

const SPT_PROMPT = `Analyze the text extracted from this PDF document and identify all tabular data with high precision. This is a standard PDF that may contain various types of tables and structured data.

Instructions:
1. Look for patterns that indicate tabular data (rows and columns of information)
2. Identify column headers and data rows from the text structure
3. Extract all table content including headers and data values
4. Maintain data relationships and preserve formatting where possible
5. Handle multi-column layouts and repeated headers appropriately
6. Include totals, subtotals, and calculated fields
7. Preserve number formatting (decimals, currency, percentages)
8. If the text structure suggests tables but formatting is unclear, use logical grouping

Return data in this exact JSON format:
{
  "tables": [
    {
      "title": "Table Name or Description",
      "headers": ["Column1", "Column2", "Column3"],
      "rows": [
        ["value1", "value2", "value3"],
        ["value4", "value5", "value6"]
      ]
    }
  ]
}

IMPORTANT: Return ONLY valid JSON. No additional text or explanations.`

const INDOMARET_PROMPT = `Analyze the text extracted from this Indomaret document and identify all tabular data with specific attention to Indomaret's document structure and format.

This document likely contains:
- Product listings with SKU, names, quantities, prices
- Transaction records with dates, stores, amounts  
- Inventory data with stock levels and movements
- Sales reports with categories and totals
- Store performance metrics

Instructions:
1. Look for Indomaret-specific data patterns (product codes, store IDs, transaction numbers)
2. Identify tabular structures from the text, even if formatting is not perfect
3. Extract all table content including headers and data values
4. Preserve numerical data accuracy (prices, quantities, percentages)
5. Maintain date/time formats from the text
6. Include summary sections and totals
7. Handle Indomaret-specific terminology and formats
8. Group related data logically based on text patterns

Return data in this exact JSON format:
{
  "tables": [
    {
      "title": "Table Name (e.g., Product List, Sales Report, Inventory)",
      "headers": ["Column1", "Column2", "Column3"],
      "rows": [
        ["value1", "value2", "value3"],
        ["value4", "value5", "value6"]
      ]
    }
  ]
}

IMPORTANT: Return ONLY valid JSON. No additional text or explanations.`

function getPromptForDocumentType(documentType: DocumentType): string {
  switch (documentType) {
    case 'indomaret':
      return INDOMARET_PROMPT
    case 'spt':
    default:
      return SPT_PROMPT
  }
}

async function extractTextFromPdf(pdfBuffer: Buffer): Promise<string> {
  try {
    console.log(`Extracting text from PDF using pdf-parse`)
    
    // Extract text from PDF
    const pdfData = await pdf(pdfBuffer)
    
    console.log(`Extracted ${pdfData.text.length} characters from ${pdfData.numpages} pages`)
    
    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error('No text content found in PDF - the document might be image-based or corrupted')
    }
    
    return pdfData.text
    
  } catch (error) {
    console.error('PDF text extraction error:', error)
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

export async function processWithLLM(
  fileBuffer: Buffer,
  fileName: string,
  documentType: DocumentType,
  conversionId: string
): Promise<ProcessingResult> {
  const startTime = Date.now()
  
  try {
    console.log(`Starting LLM processing for ${documentType} document: ${fileName}`)
    
    // Update conversion status to processing
    const supabase = createClient()
    await supabase
      .from('conversions')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', conversionId)

    // Process PDF with text extraction and GPT-4o
    console.log(`Processing PDF with text extraction for ${documentType} processing`)
    
    // Extract text from PDF first
    const pdfText = await extractTextFromPdf(fileBuffer)
    
    console.log(`Extracted text from PDF, processing with GPT-4o`)
    
    const prompt = getPromptForDocumentType(documentType)
    
    // Process with GPT-4o using text content
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nExtracted text from the PDF document:\n\n${pdfText}`
        }
      ],
      max_tokens: 4000,
      temperature: 0.1,
    })

    const aiResponse = response.choices[0]?.message?.content
    
    if (!aiResponse) {
      throw new Error('No response from OpenAI API')
    }

    console.log('AI Response:', aiResponse.substring(0, 200) + '...')
    
    // Parse the JSON response
    let extractedData: { tables: ExtractedTable[] }
    
    try {
      // Clean the response to remove any markdown formatting
      const cleanedResponse = aiResponse
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      
      extractedData = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('JSON parsing error:', parseError)
      throw new Error(`Failed to parse AI response as JSON: ${parseError}`)
    }

    // Validate the extracted data structure
    if (!extractedData || !extractedData.tables || !Array.isArray(extractedData.tables)) {
      throw new Error('Invalid data structure from AI response')
    }

    const allExtractedTables = extractedData.tables

    // Validate that we extracted at least some data
    if (allExtractedTables.length === 0) {
      throw new Error('No tables found in any pages of the PDF document')
    }

    // Calculate total data rows
    const totalDataRows = allExtractedTables.reduce((sum, table) => {
      return sum + (table.rows ? table.rows.length : 0)
    }, 0)

    const processingTimeMs = Date.now() - startTime
    
    console.log(`LLM processing completed: ${allExtractedTables.length} tables, ${totalDataRows} total rows`)

    return {
      success: true,
      tables: allExtractedTables,
      totalDataRows,
      processingTimeMs
    }

  } catch (error) {
    const processingTimeMs = Date.now() - startTime
    const errorMessage = error instanceof Error ? error.message : 'Unknown processing error'
    
    console.error('LLM processing error:', errorMessage)
    
    // Update conversion status to failed
    const supabase = createClient()
    await supabase
      .from('conversions')
      .update({ 
        status: 'failed',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
        processing_time_ms: processingTimeMs
      })
      .eq('id', conversionId)

    return {
      success: false,
      tables: [],
      totalDataRows: 0,
      error: errorMessage,
      processingTimeMs
    }
  }
}