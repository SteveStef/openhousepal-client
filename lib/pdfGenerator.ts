import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

interface PropertyDetails {
  beds?: number
  baths?: number
  squareFeet?: number
  price?: number
  city?: string
  yearBuilt?: number
  homeType?: string
  lotSize?: number
  garage?: string
}

interface PDFGenerationOptions {
  qrCodeUrl: string
  address: string
  propertyImageUrl?: string
  propertyDetails?: PropertyDetails
  filename?: string
  isPremium?: boolean
}

interface PDFPreviewOptions {
  qrCodeUrl: string
  address: string
  propertyImageUrl?: string
  propertyDetails?: PropertyDetails
  isPremium?: boolean
}

async function loadImageAsBytes(url: string): Promise<Uint8Array> {
  if (typeof window === 'undefined') {
    throw new Error('Image loading is only available in the browser environment')
  }

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

async function loadImageWithRoundedCorners(url: string, cornerRadius: number): Promise<Uint8Array> {
  if (typeof window === 'undefined') {
    throw new Error('Image loading is only available in the browser environment')
  }

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

        // Create rounded rectangle clipping path
        ctx.beginPath()
        ctx.moveTo(cornerRadius, 0)
        ctx.lineTo(canvas.width - cornerRadius, 0)
        ctx.arcTo(canvas.width, 0, canvas.width, cornerRadius, cornerRadius)
        ctx.lineTo(canvas.width, canvas.height - cornerRadius)
        ctx.arcTo(canvas.width, canvas.height, canvas.width - cornerRadius, canvas.height, cornerRadius)
        ctx.lineTo(cornerRadius, canvas.height)
        ctx.arcTo(0, canvas.height, 0, canvas.height - cornerRadius, cornerRadius)
        ctx.lineTo(0, cornerRadius)
        ctx.arcTo(0, 0, cornerRadius, 0, cornerRadius)
        ctx.closePath()
        ctx.clip()

        // Draw image with clipping applied
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

async function loadImageWithCover(url: string, width: number, height: number): Promise<Uint8Array> {
  if (typeof window === 'undefined') {
    throw new Error('Image loading is only available in the browser environment')
  }

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

        // Use 2x scale instead of 4x to save memory/processing while maintaining decent quality
        const scale = 2
        canvas.width = Math.ceil(width * scale)
        canvas.height = Math.ceil(height * scale)

        // Draw image using "cover" logic
        const imgAspect = img.width / img.height
        const canvasAspect = canvas.width / canvas.height

        let drawX, drawY, drawWidth, drawHeight

        if (imgAspect > canvasAspect) {
          // Image is wider than canvas: crop sides
          drawHeight = canvas.height
          drawWidth = drawHeight * imgAspect
          drawY = 0
          drawX = (canvas.width - drawWidth) / 2
        } else {
          // Image is taller than canvas: crop top/bottom
          drawWidth = canvas.width
          drawHeight = drawWidth / imgAspect
          drawX = 0
          drawY = (canvas.height - drawHeight) / 2
        }

        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight)

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
        console.error('Error in loadImageWithCover:', error)
        reject(error)
      }
    }

    img.onerror = (e) => {
      console.error('Failed to load image for cover processing:', e)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

async function createTemplatePDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails }: PDFPreviewOptions): Promise<Uint8Array> {
  try {
    const templateResponse = await fetch('/template2.pdf')
    if (!templateResponse.ok) {
      throw new Error('Failed to load template2.pdf')
    }
    const templateBytes = await templateResponse.arrayBuffer()

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(templateBytes)
    const firstPage = pdfDoc.getPages()[0]

    // Get page dimensions
    let { width: pageWidth, height: pageHeight } = firstPage.getSize()

    // Define target dimensions: 8.5 x 11 inches in points
    const targetWidth = 8.5 * 72
    const targetHeight = 11 * 72

    // Check if template dimensions match target 8.5 x 11 inches
    const widthDiff = Math.abs(pageWidth - targetWidth)
    const heightDiff = Math.abs(pageHeight - targetHeight)
    const tolerance = 1

    if (widthDiff > tolerance || heightDiff > tolerance) {
      console.warn('Template size mismatch - resizing to ensure 8.5 x 11 inch output...')
      firstPage.setSize(targetWidth, targetHeight)
      const newSize = firstPage.getSize()
      pageWidth = newSize.width
      pageHeight = newSize.height
    }

    // Load and embed property image if provided
    if (propertyImageUrl) {
      try {
        const imgWidth = pageWidth
        const imgHeight = 350 // Fixed height to prevent taking up too much space
        const imgX = 0
        const imgY = pageHeight - imgHeight // Anchor to top

        // Use cover image loading to crop/fit without distortion
        const propertyImageBytes = await loadImageWithCover(propertyImageUrl, imgWidth, imgHeight)
        const propertyImage = await pdfDoc.embedPng(propertyImageBytes)

        firstPage.drawImage(propertyImage, {
          x: imgX,
          y: imgY,
          width: imgWidth,
          height: imgHeight,
        })

        if (address) {
          // TODO remov the split here and just have the address
          let displayAddress = address.split(",")[0]
          let addressY = 300 // Preserve your coordinate
          
          const serifFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
          const fontSize = 22
          const maxWidth = 260
          const lineX = 35 // Fixed X for left alignment
          
          // Word wrapping logic
          const words = displayAddress.split(' ')
          const lines: string[] = []
          let currentLine = words[0]

          for (let i = 1; i < words.length; i++) {
            const word = words[i]
            const width = serifFont.widthOfTextAtSize(`${currentLine} ${word}`, fontSize)
            if (width < maxWidth) {
              currentLine += ` ${word}`
            } else {
              lines.push(currentLine)
              currentLine = word
            }
          }
          lines.push(currentLine)

          // Draw each line
          for (const line of lines) {
            firstPage.drawText(line, {
              x: lineX,
              y: addressY,
              size: fontSize,
              font: serifFont,
              color: rgb(0, 0, 0),
            })
            
            addressY -= 26
          }
        }
      } catch (error) {
        console.warn('Could not load property image:', error)
      }
    }

    // Add property stats
    if (propertyDetails) {
      const serifFont = await pdfDoc.embedFont(StandardFonts.TimesRoman)
      const fontSize = 22
      const row1Y = 200 // Moved down
      const row2Y = 80 // Moved down

      if (propertyDetails.beds !== undefined && propertyDetails.beds !== null) {
        firstPage.drawText(propertyDetails.beds.toString(), {
          x: 38,
          y: row1Y,
          size: fontSize,
          font: serifFont,
          color: rgb(0, 0, 0),
        })
      }

      if (propertyDetails.baths !== undefined && propertyDetails.baths !== null) {
        firstPage.drawText(propertyDetails.baths.toString(), {
          x: 38 + 106,
          y: row1Y,
          size: fontSize,
          font: serifFont,
          color: rgb(0, 0, 0),
        })
      }

      if (propertyDetails.squareFeet !== undefined && propertyDetails.squareFeet !== null) {
        firstPage.drawText(propertyDetails.squareFeet.toLocaleString(), {
          x: 38 + 106 + 90,
          y: row1Y,
          size: fontSize,
          font: serifFont,
          color: rgb(0, 0, 0),
        })
      }

      if (propertyDetails.price !== undefined && propertyDetails.price !== null) {
        const priceText = `$${propertyDetails.price.toLocaleString()}`

        firstPage.drawText(priceText, {
          x: 30,
          y: row2Y,
          size: fontSize,
          font: serifFont,
          color: rgb(0, 0, 0),
        })
      }
    }

    // Load and embed QR code image
    const qrCodeImageBytes = await loadImageAsBytes(qrCodeUrl)
    const qrCodeImage = await pdfDoc.embedPng(qrCodeImageBytes)

    const qrSize = 155
    const qrX = (pageWidth - qrSize) - 64
    const qrY = 153 // Default to lower position

    firstPage.drawImage(qrCodeImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    })

    // Add footer text (2 lines)
    const line1 = `© BRIGHT, All Rights Reserved | Information Deemed Reliable But Not Guaranteed.`
    const line2 = `Some properties which appear for sale may no longer be available. Data last updated: ${new Date().toLocaleDateString()}`
    const footerFontSize = 7
    const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica)
    
    const line1Width = helveticaFont.widthOfTextAtSize(line1, footerFontSize)
    const line2Width = helveticaFont.widthOfTextAtSize(line2, footerFontSize)
    
    const line1X = (pageWidth - line1Width) / 2
    const line2X = (pageWidth - line2Width) / 2
    
    const footerYBase = 15
    const lineSpacing = 10

    firstPage.drawText(line1, {
      x: line1X,
      y: footerYBase + lineSpacing,
      size: footerFontSize,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    })

    firstPage.drawText(line2, {
      x: line2X,
      y: footerYBase,
      size: footerFontSize,
      font: helveticaFont,
      color: rgb(0.5, 0.5, 0.5),
    })

    return await pdfDoc.save()

  } catch (error) {
    console.error('Error creating PDF from template:', error)
    throw new Error('Failed to create PDF from template. Please try again.')
  }
}

export async function generateTemplateQRCodePDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails, filename }: PDFGenerationOptions): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('PDF generation is only available in the browser environment')
  }

  try {
    const pdfBytes = await createTemplatePDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails })

    const pdfFilename = filename || `property-qr-${address.replace(/\s+/g, '-').toLowerCase()}.pdf`

    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = pdfFilename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    URL.revokeObjectURL(url)

  } catch (error) {
    console.error('Error generating PDF:', error)
    throw new Error('Failed to generate PDF. Please try again.')
  }
}

export async function generateTemplatePDFPreview({ qrCodeUrl, address, propertyImageUrl, propertyDetails }: PDFPreviewOptions): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF preview generation is only available in the browser environment')
  }

  try {
    const pdfBytes = await createTemplatePDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails })

    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
    
    // Use URL.createObjectURL instead of FileReader/Base64 for better performance and to avoid string length limits
    const url = URL.createObjectURL(blob)
    return url

  } catch (error) {
    console.error('Error generating PDF preview:', error)
    throw new Error('Failed to generate PDF preview. Please try again.')
  }
}

