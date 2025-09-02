import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface PropertyDetails {
  beds?: number
  baths?: number
  squareFeet?: number
  price?: number
  yearBuilt?: number
  homeType?: string
  lotSize?: number
}

interface PDFGenerationOptions {
  qrCodeUrl: string
  address: string
  propertyImageUrl?: string
  propertyDetails?: PropertyDetails
  filename?: string
}

interface PDFPreviewOptions {
  qrCodeUrl: string
  address: string
  propertyImageUrl?: string
  propertyDetails?: PropertyDetails
}

async function createPDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails }: PDFPreviewOptions): Promise<Uint8Array> {
  try {
    // Load the template PDF
    const templateResponse = await fetch('/template.pdf')
    if (!templateResponse.ok) {
      throw new Error('Failed to load template.pdf')
    }
    const templateBytes = await templateResponse.arrayBuffer()
    
    // Load the PDF document
    const pdfDoc = await PDFDocument.load(templateBytes)
    const firstPage = pdfDoc.getPages()[0]
    
    // Get page dimensions
    const { width: pageWidth, height: pageHeight } = firstPage.getSize()
    
    // Load and embed QR code image
    const qrCodeImageBytes = await loadImageAsBytes(qrCodeUrl)
    const qrCodeImage = await pdfDoc.embedPng(qrCodeImageBytes)
    
    // QR code positioning (now at top)
    // PDF coordinates start from bottom-left corner
    const qrSize = 225 // Size in points (about 2.8 inches) - made bigger
    const qrX = (pageWidth - qrSize) / 2 // Center horizontally
    const qrY = 310 // At top position
    
    // Add bronze border around entire PDF
    const borderWidth = 8 // Border width in points
    const bronzeRed = 139 / 255
    const bronzeGreen = 115 / 255 
    const bronzeBlue = 85 / 255
    
    // Draw bronze border around entire page
    firstPage.drawRectangle({
      x: 0,
      y: 0,
      width: pageWidth,
      height: borderWidth,
    })
    // Top border
    firstPage.drawRectangle({
      x: 0,
      y: pageHeight - borderWidth,
      width: pageWidth,
      height: borderWidth,
    })
    // Left border
    firstPage.drawRectangle({
      x: 0,
      y: 0,
      width: borderWidth,
      height: pageHeight,
    })
    // Right border
    firstPage.drawRectangle({
      x: pageWidth - borderWidth,
      y: 0,
      width: borderWidth,
      height: pageHeight,
    })
    
    // Add horizontal line separator above QR code
    const lineY = qrY + qrSize + 35 // Position above QR code
    const lineStartX = pageWidth * 0.1 // Start at 25% of page width
    const lineEndX = pageWidth * 0.90 // End at 75% of page width
    
    firstPage.drawLine({
      start: { x: lineStartX, y: lineY },
      end: { x: lineEndX, y: lineY },
      thickness: 4,
    })

    // Add horizontal line separator above QR code
    const lineY2 = qrY + qrSize - (qrSize / 2)// Position above QR code
    const lineStartX2 = pageWidth * 0.1 // Start at 25% of page width
    const lineEndX2 = pageWidth * 0.25 // End at 75% of page width

    firstPage.drawLine({
      start: { x: lineStartX2, y: lineY2 },
      end: { x: lineEndX2, y: lineY },
      thickness: 4,
    })

    // // Add horizontal line separator above QR code
    // const lineY3 = qrY + qrSize - (qrSize / 2) // Position above QR code
    // const lineStartX3 = pageWidth * 0.95 // Start at 25% of page width
    // const lineEndX3 = pageWidth * 0.75 // End at 75% of page width
    //
    // firstPage.drawLine({
    //   start: { x: lineStartX3, y: lineY3 },
    //   end: { x: lineEndX3, y: lineY },
    //   thickness: 4,
    //   color: { type: 'RGB', red: bronzeRed, green: bronzeGreen, blue: bronzeBlue },
    // })

    // Draw QR code on the template
    firstPage.drawImage(qrCodeImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    })
    
    // Load and embed property image if provided at the bottom
    if (propertyImageUrl) {
      try {
        const propertyImageBytes = await loadImageAsBytes(propertyImageUrl)
        
        // Try PNG first, fallback to JPEG
        let propertyImage
        try {
          propertyImage = await pdfDoc.embedPng(propertyImageBytes)
        } catch {
          propertyImage = await pdfDoc.embedJpg(propertyImageBytes)
        }
        
        // Property image positioning (now at bottom)
        const imgWidth = 360 // Width in points
        const imgHeight = 260 // Height in points
        const imgX = (pageWidth - imgWidth) / 2 // Center horizontally
        const imgY = 25 // At bottom position
        const borderWidth = 3 // Bronze border width
        
        // Bronze color in RGB (139, 115, 85) converted to 0-1 scale
        const bronzeRed = 139 / 255
        const bronzeGreen = 115 / 255
        const bronzeBlue = 85 / 255
        
        // Draw bronze border around property image
        firstPage.drawRectangle({
          x: imgX - borderWidth,
          y: imgY - borderWidth,
          width: imgWidth + (borderWidth * 2),
          height: imgHeight + (borderWidth * 2),
            })
        
        // Draw white background inside border
        firstPage.drawRectangle({
          x: imgX,
          y: imgY,
          width: imgWidth,
          height: imgHeight,
        })
        
        // Draw property image on top
        firstPage.drawImage(propertyImage, {
          x: imgX,
          y: imgY,
          width: imgWidth,
          height: imgHeight,
        })
        
        // Add black overlay section (1/4 height of image, at bottom)
        const overlayHeight = imgHeight / 4
        firstPage.drawRectangle({
          x: imgX,
          y: imgY,
          width: imgWidth,
          height: overlayHeight,
          opacity: 0.8, // Semi-transparent black
        })
        
        // Add property details text on black overlay
        if (propertyDetails) {
          const textY = imgY + overlayHeight / 2 // Center vertically in overlay
          
          // Embed a custom font (you can choose from StandardFonts)
          const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic)
          
          const fontSize = 23
          const addressWidth = boldFont.widthOfTextAtSize(address, fontSize)
          const addressX = imgX + (imgWidth - addressWidth) / 2

          firstPage.drawText(address, {
            x: addressX,
            y: textY + 5,
            size: fontSize,
            font: boldFont,
            color: rgb(1, 1, 1),
          })

          // Property details on second line (left-aligned within image)
          const details = []
          if (propertyDetails.beds) details.push(`${propertyDetails.beds}BD`)
          if (propertyDetails.baths) details.push(`${propertyDetails.baths}BA`)  
          if (propertyDetails.squareFeet) details.push(`${propertyDetails.squareFeet.toLocaleString()}SF`)
          if (propertyDetails.price) details.push(`$${propertyDetails.price.toLocaleString()}`)
          
          const detailsText = details.join(' • ')
          const detailFontSize = 17
          const detailsTextWidth = boldFont.widthOfTextAtSize(detailsText, detailFontSize)
          const detailsX = imgX + (imgWidth - detailsTextWidth) / 2

          firstPage.drawText(detailsText, {
            x: detailsX,
            y: textY - 20,
            size: detailFontSize,
            font: boldFont,
            color: rgb(1, 1, 1),
          })
        }
      } catch (error) {
        console.warn('Could not load property image:', error)
        // Continue without property image
      }
    }
    
    // Save and return the PDF bytes
    return await pdfDoc.save()
    
  } catch (error) {
    console.error('Error creating PDF from template:', error)
    throw new Error('Failed to create PDF from template. Please try again.')
  }
}

export async function generateQRCodePDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails, filename }: PDFGenerationOptions): Promise<void> {
  try {
    const pdfBytes = await createPDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails })
    
    // Generate filename if not provided
    const pdfFilename = filename || `property-qr-${address.replace(/\s+/g, '-').toLowerCase()}.pdf`
    
    // Create blob and download
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = pdfFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // Clean up the URL
    URL.revokeObjectURL(url)
    
  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate PDF. Please try again.')
  }
}

export async function generatePDFPreview({ qrCodeUrl, address, propertyImageUrl, propertyDetails }: PDFPreviewOptions): Promise<string> {
  try {
    const pdfBytes = await createPDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails })
    
    // Convert to base64 data URL for preview
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to create PDF preview'))
      reader.readAsDataURL(blob)
    })
    
  } catch (error) {
    console.error('Error generating PDF preview:', error)
    throw new Error('Failed to generate PDF preview. Please try again.')
  }
}

async function loadImageAsBytes(url: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        
        if (!ctx) {
          reject(new Error('Could not get canvas context'))
          return
        }
        
        canvas.width = img.width
        canvas.height = img.height
        
        ctx.drawImage(img, 0, 0)
        
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Failed to create blob from canvas'))
            return
          }
          
          const reader = new FileReader()
          reader.onload = () => {
            const arrayBuffer = reader.result as ArrayBuffer
            resolve(new Uint8Array(arrayBuffer))
          }
          reader.onerror = () => reject(new Error('Failed to read blob'))
          reader.readAsArrayBuffer(blob)
        }, 'image/png')
        
      } catch (error) {
        reject(error)
      }
    }
    
    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }
    
    img.src = url
  })
}
