declare module 'pdf-parse' {
  interface PDFInfo {
    PDFFormatVersion: string;
    IsAcroFormPresent: boolean;
    IsXFAPresent: boolean;
    Creator: string;
    Producer: string;
    CreationDate: string;
    ModDate: string;
  }

  interface PDFData {
    numpages: number;
    numrender: number;
    info: PDFInfo;
    metadata: any;
    version: string;
    text: string;
  }

  function parse(dataBuffer: Buffer, options?: any): Promise<PDFData>;
  
  export = parse;
}