"use client";

import { createContext, useContext, useState, useEffect } from "react";

export type CartItemAvailability = "in_stock" | "out_of_stock" | "pre_order" | "coming_soon";

export interface CartItem {
    _id: string;
    title: string;
    price: number;
    image?: string;
    qty: number;
    /** When set from product data; missing on older saved carts = not treated as pre-order */
    availability?: CartItemAvailability;
}

interface CartContextType {
    cartItems: CartItem[];
    addToCart: (product: any, qty?: number) => void; // eslint-disable-line @typescript-eslint/no-explicit-any
    removeFromCart: (id: string) => void;
    clearCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [cartItems, setCartItems] = useState<CartItem[]>([]);

    useEffect(() => {
        const savedCart = localStorage.getItem("cart");
        if (savedCart) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCartItems(JSON.parse(savedCart));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem("cart", JSON.stringify(cartItems));
    }, [cartItems]);

    const addToCart = (product: any, qty = 1) => { // eslint-disable-line @typescript-eslint/no-explicit-any
        setCartItems((prev) => {
            const existItem = prev.find((x) => x._id === product._id);
            if (existItem) {
                return prev.map((x) =>
                    x._id === product._id
                        ? {
                              ...x,
                              qty: x.qty + qty,
                              availability: product.availability ?? x.availability,
                          }
                        : x
                );
            } else {
                return [...prev, {
                    _id: product._id,
                    title: product.title,
                    price: product.price,
                    image: product.images?.[0],
                    qty,
                    availability: product.availability as CartItemAvailability | undefined,
                }];
            }
        });
    };

    const removeFromCart = (id: string) => {
        setCartItems((prev) => prev.filter((x) => x._id !== id));
    };

    const clearCart = () => {
        setCartItems([]);
    };

    return (
        <CartContext.Provider value={{ cartItems, addToCart, removeFromCart, clearCart }}>
            {children}
        </CartContext.Provider>
    );
}

export function useCart() {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return context;
}
