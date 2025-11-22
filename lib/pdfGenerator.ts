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

// Vertical Branded PDF Functions

async function createVerticalBrandedPDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails, isPremium }: PDFPreviewOptions): Promise<Uint8Array> {
  try {
    // Load the appropriate template PDF based on premium status
    // Premium users get unbranded template, basic users get branded template
    const templateName = isPremium ? 'vertical-unbranded.pdf' : 'vertical-branded.pdf'
    const templateResponse = await fetch(`/${templateName}`)
    if (!templateResponse.ok) {
      throw new Error(`Failed to load ${templateName}`)
    }
    const templateBytes = await templateResponse.arrayBuffer()

    // Load the PDF document
    const pdfDoc = await PDFDocument.load(templateBytes)
    const firstPage = pdfDoc.getPages()[0]

    // Get page dimensions
    let { width: pageWidth, height: pageHeight } = firstPage.getSize()

    // Define target dimensions: 8.5 x 11 inches in points (1 inch = 72 points)
    const targetWidth = 8.5 * 72  // 612 points
    const targetHeight = 11 * 72  // 792 points

    // Check if template dimensions match target 8.5 x 11 inches
    const widthDiff = Math.abs(pageWidth - targetWidth)
    const heightDiff = Math.abs(pageHeight - targetHeight)
    const tolerance = 1 // Allow 1 point tolerance for rounding

    if (widthDiff > tolerance || heightDiff > tolerance) {
      console.warn('Template size mismatch - resizing to ensure 8.5 x 11 inch output...')

      // Resize the page to exactly 8.5 x 11 inches
      firstPage.setSize(targetWidth, targetHeight)

      // Update our working dimensions
      const newSize = firstPage.getSize()
      pageWidth = newSize.width
      pageHeight = newSize.height
    }

    // Load and embed property image if provided (top section)
    if (propertyImageUrl) {
      try {
        // Property image positioning (top section - in the bronze/tan placeholder area)
        const imgWidth = 400 // Width in points
        const imgHeight = 230 // Height in points
        const imgX = (pageWidth - imgWidth) / 2 // Center horizontally
        const imgY = 550 // Top section position
        const cornerRadius = 50 // Rounded corner radius in pixels (for canvas)

        // Load image with rounded corners pre-applied using canvas
        const propertyImageBytes = await loadImageWithRoundedCorners(propertyImageUrl, cornerRadius)

        // Embed the rounded image (already PNG from canvas)
        const propertyImage = await pdfDoc.embedPng(propertyImageBytes)

        // Draw property image (already has rounded corners)
        firstPage.drawImage(propertyImage, {
          x: imgX,
          y: imgY,
          width: imgWidth,
          height: imgHeight,
        })

        // Add address text below image in large black text
        if (address) {
          // Concatenate city to address if available
          const displayAddress = propertyDetails?.city ? `${address}, ${propertyDetails.city}` : address

          // Position address between image and stats boxes
          const addressY = 516 // Below image (imgY=550), above stats (Y=385)

          // Embed font
          const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold)

          // Calculate available width for address text
          const padding = 40
          const availableWidth = pageWidth - padding

          // Dynamic font scaling for long addresses
          const defaultFontSize = 28 // Larger font for address
          const minFontSize = 18
          const initialAddressWidth = boldFont.widthOfTextAtSize(displayAddress, defaultFontSize)

          let fontSize = defaultFontSize
          if (initialAddressWidth > availableWidth) {
            fontSize = Math.max((availableWidth / initialAddressWidth) * defaultFontSize, minFontSize)
          }

          const addressWidth = boldFont.widthOfTextAtSize(displayAddress, fontSize)
          const addressX = (pageWidth - addressWidth) / 2 // Center on page

          firstPage.drawText(displayAddress, {
            x: addressX,
            y: addressY,
            size: fontSize,
            font: boldFont,
            color: rgb(0.4, 0.3, 0.2), // Match stats brown color
          })
        }
      } catch (error) {
        console.warn('Could not load property image:', error)
        // Continue without property image
      }
    }

    // Add property stats to the four boxes
    if (propertyDetails) {
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      const fontSize = 22

      // BEDS box (top left)
      if (propertyDetails.beds !== undefined && propertyDetails.beds !== null) {
        const bedsText = propertyDetails.beds.toString()
        firstPage.drawText(bedsText, {
          x: 155,
          y: 450,
          size: fontSize,
          font: font,
          color: rgb(0.4, 0.3, 0.2),
        })
      }

      // BATHS box (top right)
      if (propertyDetails.baths !== undefined && propertyDetails.baths !== null) {
        const bathsText = propertyDetails.baths.toString()
        const bathsWidth = font.widthOfTextAtSize(bathsText, fontSize)
        firstPage.drawText(bathsText, {
          x: 155 + 170,
          y: 450,
          size: fontSize,
          font: font,
          color: rgb(0.4, 0.3, 0.2),
        })
      }

      // SQ FT box (bottom left)
      if (propertyDetails.squareFeet !== undefined && propertyDetails.squareFeet !== null) {
        const sqftText = propertyDetails.squareFeet.toLocaleString()
        firstPage.drawText(sqftText, {
          x: 155,
          y: 383,
          size: fontSize,
          font: font,
          color: rgb(0.4, 0.3, 0.2),
        })
      }

      // PRICE box (bottom right)
      if (propertyDetails.price !== undefined && propertyDetails.price !== null) {
        // Format price dynamically: use M for millions, K for thousands
        let priceText: string
        if (propertyDetails.price >= 1000000) {
          // Format as millions (e.g., $1.5M, $2.3M)
          priceText = `$${(propertyDetails.price / 1000000).toFixed(1)}M`
        } else {
          // Format as thousands (e.g., $450K, $999K)
          priceText = `$${(propertyDetails.price / 1000).toFixed(0)}K`
        }

        firstPage.drawText(priceText, {
          x: 155 + 170,
          y: 383,
          size: fontSize,
          font: font,
          color: rgb(0.4, 0.3, 0.2),
        })
      }
    }

    // Load and embed QR code image (bottom section)
    const qrCodeImageBytes = await loadImageAsBytes(qrCodeUrl)
    const qrCodeImage = await pdfDoc.embedPng(qrCodeImageBytes)

    // QR code positioning (bottom section - in the QR placeholder area)
    const qrSize = 150;
    const qrX = (pageWidth - qrSize) / 2 // Center horizontally
    const qrY = isPremium ? 86 : 102; // Bottom section position

    // Draw QR code on the template
    firstPage.drawImage(qrCodeImage, {
      x: qrX,
      y: qrY,
      width: qrSize,
      height: qrSize,
    })

    // Save and return the PDF bytes
    return await pdfDoc.save()

  } catch (error) {
    console.error('Error creating vertical branded PDF from template:', error)
    throw new Error('Failed to create vertical branded PDF from template. Please try again.')
  }
}

export async function generateVerticalBrandedQRCodePDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails, filename, isPremium }: PDFGenerationOptions): Promise<void> {
  if (typeof window === 'undefined') {
    throw new Error('PDF generation is only available in the browser environment')
  }

  try {
    const pdfBytes = await createVerticalBrandedPDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails, isPremium })

    // Generate filename if not provided
    const pdfFilename = filename || `vertical-property-qr-${address.replace(/\s+/g, '-').toLowerCase()}.pdf`

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
    console.error('Error generating vertical branded PDF:', error)
    throw new Error('Failed to generate vertical branded PDF. Please try again.')
  }
}

export async function generateVerticalBrandedPDFPreview({ qrCodeUrl, address, propertyImageUrl, propertyDetails, isPremium }: PDFPreviewOptions): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('PDF preview generation is only available in the browser environment')
  }

  try {
    const pdfBytes = await createVerticalBrandedPDF({ qrCodeUrl, address, propertyImageUrl, propertyDetails, isPremium })

    // Convert to base64 data URL for preview
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' })
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(new Error('Failed to create vertical branded PDF preview'))
      reader.readAsDataURL(blob)
    })

  } catch (error) {
    console.error('Error generating vertical branded PDF preview:', error)
    throw new Error('Failed to generate vertical branded PDF preview. Please try again.')
  }
}
