"use client";

import { motion } from "framer-motion";
import { Mail, MapPin, Phone, Send } from "lucide-react";
import { useState } from "react";

export default function ContactPage() {
    const [formState, setFormState] = useState({
        name: "",
        email: "",
        subject: "",
        message: ""
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Here you would typically send the data to your API
        alert("Message sent! We will get back to you shortly.");
        setFormState({ name: "", email: "", subject: "", message: "" });
    };

    return (
        <div className="min-h-screen py-20">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">Contact Us</h1>
                    <p className="text-xl text-gray-400">Get in touch with the Omniware team.</p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {/* Contact Info */}
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="space-y-8"
                    >
                        <div className="glass p-8 rounded-2xl">
                            <h3 className="text-2xl font-bold text-white mb-6">Visit Our Store</h3>
                            <div className="space-y-6">
                                <div className="flex items-start space-x-4">
                                    <MapPin className="h-6 w-6 text-primary mt-1" />
                                    <div>
                                        <p className="text-white font-medium">Omniware HQ</p>
                                        <p className="text-gray-400">123 Tech Avenue,<br />Colombo 03, Sri Lanka</p>
                                    </div>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <Phone className="h-6 w-6 text-primary" />
                                    <p className="text-gray-300">+94 11 234 5678</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                    <Mail className="h-6 w-6 text-primary" />
                                    <p className="text-gray-300">hello@omniware.lk</p>
                                </div>
                            </div>
                        </div>

                        <div className="glass p-8 rounded-2xl">
                            <h3 className="text-xl font-bold text-white mb-4">Opening Hours</h3>
                            <div className="space-y-2 text-gray-300">
                                <div className="flex justify-between">
                                    <span>Monday - Friday</span>
                                    <span>9:00 AM - 7:00 PM</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Saturday</span>
                                    <span>10:00 AM - 5:00 PM</span>
                                </div>
                                <div className="flex justify-between">
                                    <span>Sunday</span>
                                    <span className="text-primary">Closed</span>
                                </div>
                            </div>
                        </div>
                    </motion.div>

                    {/* Contact Form */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass p-8 rounded-2xl"
                    >
                        <h3 className="text-2xl font-bold text-white mb-6">Send us a Message</h3>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Your Name</label>
                                    <input
                                        type="text"
                                        required
                                        value={formState.name}
                                        onChange={e => setFormState({ ...formState, name: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
                                        placeholder="John Doe"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
                                    <input
                                        type="email"
                                        required
                                        value={formState.email}
                                        onChange={e => setFormState({ ...formState, email: e.target.value })}
                                        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
                                        placeholder="john@example.com"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Subject</label>
                                <input
                                    type="text"
                                    required
                                    value={formState.subject}
                                    onChange={e => setFormState({ ...formState, subject: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
                                    placeholder="Inquiry about custom build"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-2">Message</label>
                                <textarea
                                    required
                                    rows={4}
                                    value={formState.message}
                                    onChange={e => setFormState({ ...formState, message: e.target.value })}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:outline-none transition-colors"
                                    placeholder="How can we help you?"
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                            >
                                <Send className="h-5 w-5" />
                                Send Message
                            </button>
                        </form>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
