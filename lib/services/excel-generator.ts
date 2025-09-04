import ExcelJS from 'exceljs'
import { ExtractedTable } from './llm-processor'
import { DocumentType } from '@/lib/supabase/types'

export interface ExcelGenerationResult {
  success: boolean
  buffer?: Buffer
  fileName: string
  error?: string
}

export async function generateExcel(
  tables: ExtractedTable[],
  originalFileName: string,
  documentType: DocumentType
): Promise<ExcelGenerationResult> {
  try {
    console.log(`Generating Excel for ${documentType} document with ${tables.length} tables`)
    
    const workbook = new ExcelJS.Workbook()
    
    // Set workbook properties
    workbook.creator = 'PDF to Excel Converter'
    workbook.lastModifiedBy = 'PDF to Excel Converter'
    workbook.created = new Date()
    workbook.modified = new Date()
    
    // If no tables found, create an empty sheet with a message
    if (tables.length === 0) {
      const worksheet = workbook.addWorksheet('No Data Found')
      worksheet.addRow(['No tabular data was found in the PDF document'])
      worksheet.addRow(['Please ensure the document contains tables or structured data'])
      
      // Style the message
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFF0000' } }
      worksheet.getRow(2).font = { italic: true }
      
      worksheet.getColumn(1).width = 50
    } else {
      // Create a summary sheet
      const summarySheet = workbook.addWorksheet('Summary')
      
      // Add header information
      summarySheet.addRow(['PDF to Excel Conversion Summary'])
      summarySheet.addRow([])
      summarySheet.addRow(['Original File:', originalFileName])
      summarySheet.addRow(['Document Type:', documentType.toUpperCase()])
      summarySheet.addRow(['Conversion Date:', new Date().toLocaleDateString()])
      summarySheet.addRow(['Tables Found:', tables.length])
      
      const totalRows = tables.reduce((sum, table) => sum + table.rows.length, 0)
      summarySheet.addRow(['Total Data Rows:', totalRows])
      summarySheet.addRow([])
      
      // Style the summary sheet header
      summarySheet.getRow(1).font = { bold: true, size: 16, color: { argb: 'FF0066CC' } }
      summarySheet.getColumn(1).width = 20
      summarySheet.getColumn(2).width = 30
      
      // Add table of contents
      summarySheet.addRow(['Table of Contents:'])
      summarySheet.getRow(9).font = { bold: true, size: 14 }
      
      tables.forEach((table, index) => {
        const sheetName = table.title || `Table_${index + 1}`
        summarySheet.addRow([`Sheet ${index + 2}:`, sheetName, `${table.rows.length} rows`])
      })
      
      // Create worksheets for each table
      tables.forEach((table, index) => {
        const sheetName = table.title 
          ? sanitizeSheetName(table.title)
          : `Table_${index + 1}`
        
        const worksheet = workbook.addWorksheet(sheetName)
        
        // Add table title as header
        if (table.title) {
          worksheet.addRow([table.title])
          worksheet.getRow(1).font = { bold: true, size: 14, color: { argb: 'FF0066CC' } }
          worksheet.addRow([]) // Empty row
        }
        
        // Add headers if they exist
        if (table.headers && table.headers.length > 0) {
          const headerRow = worksheet.addRow(table.headers)
          
          // Style headers
          headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
          headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
          }
          
          // Add borders to headers
          headerRow.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            }
          })
        }
        
        // Add data rows
        table.rows.forEach((row, rowIndex) => {
          const dataRow = worksheet.addRow(row)
          
          // Alternate row colors for better readability
          if (rowIndex % 2 === 0) {
            dataRow.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFF2F2F2' }
            }
          }
          
          // Add borders to data cells
          dataRow.eachCell((cell) => {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' }
            }
            
            // Auto-detect and format numbers
            if (typeof cell.value === 'string') {
              const numValue = parseFloat(cell.value.replace(/[^0-9.-]/g, ''))
              if (!isNaN(numValue) && cell.value.match(/^[\d.,\s$%]+$/)) {
                cell.value = numValue
                
                // Format as currency if contains $ symbol
                if (cell.value.toString().includes('$')) {
                  cell.numFmt = '"$"#,##0.00_);[Red]("$"#,##0.00)'
                }
                // Format as percentage if contains % symbol
                else if (cell.value.toString().includes('%')) {
                  cell.numFmt = '0.00%'
                }
                // Format as number with comma separators
                else if (numValue > 999) {
                  cell.numFmt = '#,##0.00'
                }
              }
            }
          })
        })
        
        // Auto-fit column widths
        worksheet.columns.forEach((column, colIndex) => {
          let maxWidth = 10
          
          // Check header width
          if (table.headers && table.headers[colIndex]) {
            maxWidth = Math.max(maxWidth, table.headers[colIndex].length)
          }
          
          // Check data widths (sample first 10 rows for performance)
          table.rows.slice(0, 10).forEach(row => {
            if (row[colIndex]) {
              maxWidth = Math.max(maxWidth, row[colIndex].toString().length)
            }
          })
          
          // Set width with reasonable limits
          column.width = Math.min(Math.max(maxWidth + 2, 10), 50)
        })
        
        // Freeze the header row
        if (table.headers && table.headers.length > 0) {
          const headerRowNum = table.title ? 3 : 1
          worksheet.views = [{ state: 'frozen', xSplit: 0, ySplit: headerRowNum }]
        }
      })
    }
    
    // Generate the Excel file buffer
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer())
    
    // Generate the output filename
    const baseFileName = originalFileName.replace(/\.pdf$/i, '')
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
    const fileName = `${baseFileName}_${documentType}_converted_${timestamp}.xlsx`
    
    console.log(`Excel generation completed: ${fileName}`)
    
    return {
      success: true,
      buffer,
      fileName
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Excel generation failed'
    console.error('Excel generation error:', errorMessage)
    
    return {
      success: false,
      fileName: originalFileName.replace(/\.pdf$/i, '_error.xlsx'),
      error: errorMessage
    }
  }
}

function sanitizeSheetName(name: string): string {
  // Excel sheet name limitations:
  // - Max 31 characters
  // - Cannot contain: \ / * ? : [ ]
  // - Cannot be empty
  
  let sanitized = name
    .replace(/[\\\/\*\?\:\[\]]/g, '_')
    .substring(0, 31)
    .trim()
  
  if (sanitized.length === 0) {
    sanitized = 'Sheet'
  }
  
  return sanitized
}