"use client";

import { motion } from "framer-motion";

export default function AboutPage() {
    return (
        <div className="min-h-screen py-20">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mb-16"
                >
                    <h1 className="text-4xl md:text-5xl font-bold text-white mb-6">About Omniware</h1>
                    <div className="w-24 h-1 bg-primary mx-auto rounded-full mb-8" />
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="glass p-8 md:p-12 rounded-3xl"
                >
                    <div className="space-y-6 text-lg text-gray-300 leading-relaxed">
                        <p>
                            Welcome to <span className="text-white font-bold">Omniware</span>, Sri Lanka&apos;s premier destination for custom PC builds and high-end computer components.
                        </p>
                        <p>
                            We are passionate about technology and dedicated to providing our customers with the best possible experience. Whether you are a hardcore gamer, a creative professional, or someone who simply needs a reliable computer for daily tasks, we have the expertise to build the perfect machine for you.
                        </p>
                        <p>
                            Our team consists of experienced technicians and hardware enthusiasts who stay up-to-date with the latest trends and technologies. We carefully select every component we sell and use in our builds to ensure maximum performance, reliability, and biological aesthetics.
                        </p>
                        <p>
                            At Omniware, we don&apos;t just sell computers; we build relationships. We are committed to offering exceptional after-sales support and warranty services, so you can have peace of mind knowing that we are always here to help.
                        </p>
                    </div>
                </motion.div>

                {/* Stats or Values (Optional) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 }}
                        className="text-center p-6"
                    >
                        <h3 className="text-4xl font-bold text-white mb-2">5+</h3>
                        <p className="text-gray-500 uppercase tracking-wide text-sm">Years Experience</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className="text-center p-6"
                    >
                        <h3 className="text-4xl font-bold text-white mb-2">1000+</h3>
                        <p className="text-gray-500 uppercase tracking-wide text-sm">Builds Completed</p>
                    </motion.div>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 }}
                        className="text-center p-6"
                    >
                        <h3 className="text-4xl font-bold text-white mb-2">100%</h3>
                        <p className="text-gray-500 uppercase tracking-wide text-sm">Customer Satisfaction</p>
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
