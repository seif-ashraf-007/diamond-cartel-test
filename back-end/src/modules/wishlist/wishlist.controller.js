import nodemailer from "nodemailer";
import { Product } from "../../../DB/models/product.schema.js";
import { Wishlist } from "../../../DB/models/wishlist.schema.js";
import { catchError } from "../../MiddleWares/CatchError.js";
import { AppError } from "../../utils/appError.js";
import { sendEmail } from "../../utils/mailer.js";
import dotenv from "dotenv";

dotenv.config();

let FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5000";

const sendWishlistEmail = catchError(async (req, res, next) => {
  // Use authenticated user ID if available, fall back to session ID
  const userId = req.user?._id.toString() || req.session?.userId;
  let totalPrice = 0;
  const formData = req.body;

  let wishlist = null;

  if (formData.itemsDetails) {
    wishlist = formData.itemsDetails;
  }

  // Process form data into a nicely formatted table
  let formFieldsHtml = Object.keys(formData)
    .map((key) => {
      // Skip empty values
      if (!formData[key]) return "";

      // Format the label for better display
      const label = key
        .replace(/_/g, " ")
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      // Skip itemsDetails since we'll handle it separately
      if (key === "itemsDetails") return "";

      return `
        <tr>
          <td style="padding: 8px 15px; border-bottom: 1px solid #e2e8f0; font-weight: 600; width: 40%;">${label}</td>
          <td style="padding: 8px 15px; border-bottom: 1px solid #e2e8f0;">${formData[key]}</td>
        </tr>
      `;
    })
    .filter((item) => item !== "") // Filter out empty entries
    .join("");

  // Create a properly formatted wishlist items section
  let formattedWishlistItems = "";
  if (formData.itemsDetails) {
    formattedWishlistItems = formData.itemsDetails
      .map((item) => {
        totalPrice += item.price * item.quantity;
        return `
        <tr>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0;">
            <img src="${item.image}" alt="${
          item.name
        }" style="width: 50px; height: 50px; object-fit: cover; margin-right: 10px;" />
            <div>
              <strong>${item.name}</strong><br>
              <span style="color: #64748b; font-size: 14px;">Quantity: ${
                item.quantity
              }</span>
            </div>
          </td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${item.price.toFixed(
            2
          )}</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: right;">$${item.total.toFixed(
            2
          )}</td>
          <td style="padding: 12px 15px; border-bottom: 1px solid #e2e8f0; text-align: right;"><a href="${FRONTEND_URL}/product/${
          item.id
        }">View Product</a></td>
        </tr>
      `;
      })
      .join("");
  }

  // Create form data section if there's any form data
  let formSection = "";
  if (formFieldsHtml) {
    formSection = `
      <div style="margin-bottom: 30px; background-color: #f8fafc; border-radius: 8px; padding: 20px;">
        <h2 style="color: #1e293b; margin-top: 0; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Request Details</h2>
        <table style="width: 100%; border-collapse: collapse;">
          ${formFieldsHtml}
        </table>
      </div>
    `;
  }

  // Create wishlist section
  let wishlistSection = "";

  if (wishlist) {
    wishlistSection = `
      <div style="margin-bottom: 30px; background-color: #f8fafc; border-radius: 8px; padding: 20px;">
        <h2 style="color: #1e293b; margin-top: 0; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Wishlist Items</h2>
        
        <table style="width: 100%; border-collapse: collapse; margin: 20px auto;">
          <thead>
            <tr style="background-color: #f1f5f9;">
              <th style="padding: 12px 15px; text-align: left; border-bottom: 2px solid #e2e8f0;">Product</th>
              <th style="padding: 12px 15px; text-align: center; border-bottom: 2px solid #e2e8f0;">Price Per Unit</th>
              <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e2e8f0;">Total Price</th>
            <th style="padding: 12px 15px; text-align: right; border-bottom: 2px solid #e2e8f0;">View Product</th>
              </tr>
          </thead>
          <tbody>
            ${formattedWishlistItems}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3" style="padding: 12px 15px; text-align: right; font-weight: 600; border-top: 2px solid #e2e8f0;">Total:</td>
              <td style="padding: 12px 15px; text-align: right; font-weight: 600; border-top: 2px solid #e2e8f0;">$${totalPrice.toFixed(
                2
              )}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  } else {
    wishlistSection = `
      <div style="margin-bottom: 30px; background-color: #f8fafc; border-radius: 8px; padding: 20px;">
        <h2 style="color: #1e293b; margin-top: 0; margin-bottom: 15px; font-size: 18px; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px;">Wishlist Items</h2>
        <p style="color: #64748b; font-style: italic;">No wishlist items included in this submission.</p>
      </div>
    `;
  }

  // Assemble the complete email template
  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${wishlist ? "Wishlist Submission" : "Quote Request"}</title>
    </head>
    <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background-color: #f9fafb; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 10px auto; background-color: #ffffff; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        
        <!-- Header -->
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 1px solid #e2e8f0;">
          <h1 style="color: #1e293b; margin-top: 0; margin-bottom: 10px; font-size: 24px;">${
            wishlist ? "Wishlist Submission" : "Quote Request"
          }</h1>
          <p style="color: #64748b; margin: 0;">Received on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}</p>
        </div>
        
        <!-- Form Data Section -->
        ${formSection}
        
        <!-- Wishlist Section -->
        ${wishlistSection}
        
        <!-- Footer -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 14px;">
          <p>All rights reserved, @2025 Diamond Cartel</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const ownerEmail = process.env.OWNER_EMAIL;
    await sendEmail(
      ownerEmail,
      "New wishlist request from " + userId,
      emailHtml
    );
    res.json({
      message: wishlist
        ? "Wishlist sent successfully!"
        : "Quote Request sent successfully!",
    });
  } catch (error) {
    return next(new AppError("Failed to send email", 500));
  }
});

const AddToWishlist = catchError(async (req, res, next) => {
  const userId = req.session.userId;
  if (!userId)
    return next(new AppError("User ID is missing - AddToWishlist", 400));

  const product = await Product.findById(req.body.wishlistItems[0].product);
  if (!product) return next(new AppError("Product Not Found", 404));

  const wishlistItem = {
    product: req.body.wishlistItems[0].product,
    price: product.price,
    quantity: req.body.wishlistItems[0].quantity || 1,
  };

  if (wishlistItem.quantity > product.stock)
    return next(new AppError("Sold Out", 404));

  let wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) {
    wishlist = new Wishlist({
      userId,
      wishlistItems: [wishlistItem],
      totalWishlistprice: wishlistItem.price * wishlistItem.quantity,
    });
  } else {
    const existingItem = wishlist.wishlistItems.find(
      (item) => item.product.toString() === wishlistItem.product
    );

    if (existingItem) {
      existingItem.quantity += wishlistItem.quantity;
      if (existingItem.quantity > product.stock)
        return next(new AppError("Sold Out", 404));
    } else {
      wishlist.wishlistItems.push(wishlistItem);
    }

    // Recalculate total price
    wishlist.totalWishlistprice = wishlist.wishlistItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
  }

  await wishlist.save();

  res.status(201).json({ message: "Item added to wishlist", wishlist });
});

const getUserWishlist = catchError(async (req, res, next) => {
  if (!req.session.userId) {
    return next(new AppError("User ID is missing - getUserWishlist", 400));
  }

  let wishlist = await Wishlist.findOne({ userId: req.session.userId });
  if (!wishlist) {
    // Return an empty wishlist instead of throwing an error
    return res.status(200).json({
      message: "No wishlist found for the user",
      wishlist: { wishlistItems: [], totalWishlistprice: 0 },
    });
  }

  res.status(200).json({ message: "Success", wishlist });
});

const removeItemFromWishlist = catchError(async (req, res, next) => {
  const wishlist = await Wishlist.findOneAndUpdate(
    { userId: req.session.userId },
    { $pull: { wishlistItems: { _id: req.params.id } } },
    { new: true }
  );

  if (!wishlist) {
    return next(new AppError("Wishlist not found", 404));
  }

  // Recalculate total price
  wishlist.totalWishlistprice = wishlist.wishlistItems.reduce(
    (prev, item) => prev + item.quantity * item.price,
    0
  );
  await wishlist.save();

  res.status(200).json({
    message: "Item removed successfully",
    wishlist,
  });
});

const clearUserWishlist = catchError(async (req, res, next) => {
  const wishlist = await Wishlist.findOneAndDelete({
    userId: req.session.userId,
  });

  if (!wishlist) {
    return res.status(200).json({ message: "Wishlist is already empty" });
  }

  res.status(200).json({ message: "Wishlist cleared successfully" });
});

const updateWishlistItem = catchError(async (req, res, next) => {
  const { userId } = req.session;
  const { id } = req.params;
  const { quantity } = req.body;

  if (!userId)
    return next(new AppError("User ID is missing - updateWishlistItem", 400));

  if (!quantity || quantity < 1)
    return next(new AppError("Invalid quantity", 400));

  const wishlist = await Wishlist.findOne({ userId });

  if (!wishlist) return next(new AppError("Wishlist not found", 404));

  const item = wishlist.wishlistItems.id(id);
  if (!item) return next(new AppError("Item not found in wishlist", 404));

  // Check product availability
  const product = await Product.findById(item.product);
  if (!product) return next(new AppError("Product not found", 404));

  if (quantity > product.stock)
    return next(
      new AppError("Requested quantity exceeds available stock", 400)
    );

  // Update quantity
  item.quantity = quantity;

  // Recalculate total price
  wishlist.totalWishlistprice = wishlist.wishlistItems.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  await wishlist.save();

  res.status(200).json({
    message: "Item quantity updated successfully",
    wishlist,
  });
});

export {
  AddToWishlist,
  removeItemFromWishlist,
  getUserWishlist,
  clearUserWishlist,
  sendWishlistEmail,
  updateWishlistItem,
};
