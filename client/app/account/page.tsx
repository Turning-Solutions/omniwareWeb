"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Package } from "lucide-react";

export default function AccountPage() {
    const router = useRouter();
    const [user, setUser] = useState<any>(null); // eslint-disable-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [orders, setOrders] = useState<any[]>([]);

    useEffect(() => {
        const userInfo = localStorage.getItem("userInfo");
        if (!userInfo) {
            router.push("/login");
            return;
        }
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setUser(JSON.parse(userInfo));

        // Mock orders or fetch
        // fetchOrders();
        setOrders([
            { _id: "1", orderNo: "ORD-001", totalPrice: 650000, status: "Delivered", createdAt: "2023-10-01" },
            { _id: "2", orderNo: "ORD-002", totalPrice: 25000, status: "Processing", createdAt: "2023-11-15" }
        ]);
    }, [router]);

    const handleLogout = () => {
        localStorage.removeItem("userInfo");
        router.push("/login");
    };

    if (!user) return null;

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold text-white">My Account</h1>
                <button onClick={handleLogout} className="text-red-400 hover:text-red-300">
                    Sign Out
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Profile Card */}
                <div className="glass p-8 rounded-2xl h-fit">
                    <div className="flex items-center space-x-4 mb-6">
                        <div className="h-16 w-16 bg-primary rounded-full flex items-center justify-center text-2xl font-bold text-white">
                            {user.name.charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{user.name}</h2>
                            <p className="text-gray-400">{user.email}</p>
                            <p className="text-xs text-primary mt-1 uppercase">{user.role}</p>
                        </div>
                    </div>
                </div>

                {/* Orders */}
                <div className="lg:col-span-2">
                    <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                        <Package className="h-5 w-5" /> Order History
                    </h2>
                    <div className="space-y-4">
                        {orders.map(order => (
                            <div key={order._id} className="glass p-6 rounded-xl flex items-center justify-between">
                                <div>
                                    <h3 className="font-bold text-white">{order.orderNo}</h3>
                                    <p className="text-sm text-gray-400">Placed on {order.createdAt}</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-bold text-primary">LKR {order.totalPrice.toLocaleString()}</p>
                                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold mt-1 
                     ${order.status === 'Delivered' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}`}>
                                        {order.status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
