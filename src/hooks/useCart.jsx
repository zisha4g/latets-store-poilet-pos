import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

    const CART_STORAGE_KEY = 'e-commerce-cart';

    export const useCart = () => useContext(CartContext);

    const CartContext = createContext();

    export const CartProvider = ({ children }) => {
      const [cartItems, setCartItems] = useState(() => {
        try {
          const storedCart = localStorage.getItem(CART_STORAGE_KEY);
          return storedCart ? JSON.parse(storedCart) : [];
        } catch (error) {
          return [];
        }
      });

      useEffect(() => {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
      }, [cartItems]);

      const addToCart = useCallback((product, variant, quantity) => {
        return new Promise((resolve, reject) => {
          const existingItem = cartItems.find(item => item.variant.id === variant.id);
          const currentCartQuantity = existingItem ? existingItem.quantity : 0;
          const availableQuantity = product.stock;

          if ((currentCartQuantity + quantity) > availableQuantity) {
            const error = new Error(`Not enough stock for ${product.name}. Only ${availableQuantity} left.`);
            reject(error);
            return;
          }

          setCartItems(prevItems => {
            if (existingItem) {
              return prevItems.map(item =>
                item.variant.id === variant.id
                  ? { ...item, quantity: item.quantity + quantity }
                  : item
              );
            }
            return [...prevItems, { product, variant, quantity }];
          });
          resolve();
        });
      }, [cartItems]);
      
      const removeFromCart = useCallback((variantId) => {
        setCartItems(prevItems => prevItems.filter(item => item.variant.id !== variantId));
      }, []);

      const updateQuantity = useCallback((variantId, quantity) => {
        setCartItems(prevItems =>
          prevItems.map(item => {
            if (item.variant.id === variantId) {
              const newQuantity = Math.max(0, quantity);
              if (item.product.stock && newQuantity > item.product.stock) {
                return { ...item, quantity: item.product.stock };
              }
              return { ...item, quantity: newQuantity };
            }
            return item;
          }).filter(item => item.quantity > 0)
        );
      }, []);

      const clearCart = useCallback(() => {
        setCartItems([]);
      }, []);

      const getCartTotal = useCallback(() => {
        return cartItems.reduce((total, item) => {
          return total + item.product.price * item.quantity;
        }, 0);
      }, [cartItems]);

      const value = useMemo(() => ({
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
      }), [cartItems, addToCart, removeFromCart, updateQuantity, clearCart, getCartTotal]);

      return (
        <CartContext.Provider value={value}>
          {children}
        </CartContext.Provider>
      )
    };