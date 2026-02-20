import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Bot, Building2, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface Message {
    id: string;
    role: "user" | "bot";
    content: string;
    relatedProperties?: any[];
}

const PropertyChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "bot",
            content: "Hi! I'm your PropertyPal AI assistant. Tell me what you're looking for! (e.g., '3 bedroom apartment in JB under RM 2000')",
        },
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    const extractSearchCriteria = (text: string) => {
        try {
            if (!text) return {};
            const criteria: any = {};
            const lowerText = text.toLowerCase();

            // 1. Extract Bedrooms (e.g., "3 bedroom", "3 beds", "3 room")
            const bedMatch = lowerText.match(/(\d+)\s*(?:bed|room)/);
            if (bedMatch) criteria.minBeds = parseInt(bedMatch[1]);

            // 2. Extract Price (e.g., "under 2000", "rm 2000", "< 2000")
            // Simple heuristic: look for "under" or "rm" followed by number
            const priceMatch = lowerText.match(/(?:under|rm|max|budget)\s*(\d+)/) || lowerText.match(/<\s*(\d+)/);
            if (priceMatch) criteria.maxPrice = parseInt(priceMatch[1]);

            // 3. Extract Property Type
            const types = ["apartment", "condo", "condominium", "terrace", "flat", "bungalow", "semi-d", "house"];
            const foundType = types.find(t => lowerText.includes(t));
            if (foundType) {
                criteria.type = foundType === "condo" ? "condominium" : foundType;
            }

            // 4. Extract Location
            const locations = ["johor bahru", "jb", "skudai", "mount austin", "pasir gudang", "kulai", "muar", "batu pahat"];
            const foundLoc = locations.find(l => lowerText.includes(l));
            if (foundLoc) criteria.location = foundLoc;

            return criteria;
        } catch (e) {
            console.error("NLP extraction failed", e);
            return {};
        }
    };

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: inputValue,
        };

        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");
        setIsTyping(true);

        try {
            const criteria = extractSearchCriteria(userMsg.content);

            let query = supabase.from("property").select("property_id, property_type, location, rental_price, num_bedroom, num_bathroom, property_size, description, availability_status, images");

            // Apply Filters based on extracted NLP
            if (criteria.minBeds) {
                query = query.gte("num_bedroom", criteria.minBeds);
            }
            if (criteria.maxPrice) {
                query = query.lte("rental_price", criteria.maxPrice);
            }
            if (criteria.type) {
                query = query.ilike("property_type", `%${criteria.type}%`);
            }
            if (criteria.location) {
                query = query.ilike("location", `%${criteria.location}%`);
            }

            // Limit results
            const { data, error } = await query.limit(3);

            if (error) {
                console.error("Supabase Query Error:", error);
                throw error;
            }

            let botResponse = "";
            if (data && data.length > 0) {
                botResponse = `I found ${data.length} properties that match your description!`;
            } else {
                botResponse = "I couldn't find any properties matching that specific description. Try broadening your search?";
            }

            const botMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "bot",
                content: botResponse,
                relatedProperties: data || [],
            };

            setMessages((prev) => [...prev, botMsg]);

        } catch (error) {
            console.error("Chatbot Error:", error);
            const errorMsg: Message = {
                id: (Date.now() + 1).toString(),
                role: "bot",
                content: "Sorry, I encountered an error while searching. Please try again.",
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSend();
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <Card className="w-80 md:w-96 h-[500px] mb-4 shadow-2xl border-primary/20 flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300">
                    {/* Header */}
                    <div className="p-4 bg-primary text-primary-foreground rounded-t-lg flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">PropertyPal AI</span>
                        </div>
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-primary-foreground hover:bg-primary/90" onClick={() => setIsOpen(false)}>
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Messages Area */}
                    <ScrollArea className="flex-1 p-4 bg-muted/30">
                        <div className="space-y-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div
                                        className={`max-w-[85%] rounded-2xl px-4 py-2 ${msg.role === "user"
                                            ? "bg-primary text-primary-foreground rounded-br-none"
                                            : "bg-card border shadow-sm rounded-bl-none"
                                            }`}
                                    >
                                        <p className="text-sm">{msg.content}</p>

                                        {/* Property Cards within Logic */}
                                        {msg.relatedProperties && msg.relatedProperties.length > 0 && (
                                            <div className="mt-3 space-y-2">
                                                {msg.relatedProperties.map((prop) => (
                                                    <Link to="/auth" key={prop.property_id} className="block group">
                                                        <div className="bg-background/50 p-2 rounded border hover:border-primary transition-colors flex gap-2">
                                                            <div className="h-12 w-12 bg-muted rounded overflow-hidden flex-shrink-0">
                                                                {prop.images && prop.images[0] ? (
                                                                    <img src={prop.images[0]} alt="Prop" className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <Building2 className="p-2 h-full w-full text-muted-foreground" />
                                                                )}
                                                            </div>
                                                            <div className="overflow-hidden">
                                                                <p className="text-xs font-semibold truncate group-hover:text-primary">{prop.property_type}</p>
                                                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                                    <MapPin className="w-3 h-3" /> {prop.location}
                                                                </p>
                                                                <p className="text-xs font-bold text-primary mt-1">RM {prop.rental_price}</p>
                                                            </div>
                                                        </div>
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {isTyping && (
                                <div className="flex justify-start">
                                    <div className="bg-card border shadow-sm rounded-2xl rounded-bl-none px-4 py-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                                    </div>
                                </div>
                            )}
                            <div ref={scrollRef} />
                        </div>
                    </ScrollArea>

                    {/* Input Area */}
                    <div className="p-3 border-t bg-background rounded-b-lg flex gap-2">
                        <Input
                            placeholder="Ask for a property..."
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyPress}
                            className="flex-1"
                            disabled={isTyping}
                        />
                        <Button size="icon" onClick={handleSend} disabled={!inputValue.trim() || isTyping}>
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </Card>
            )}

            {/* Toggle Button */}
            {!isOpen && (
                <Button
                    size="lg"
                    className="rounded-full h-14 w-14 shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 bg-gradient-to-r from-primary to-purple-600"
                    onClick={() => setIsOpen(true)}
                >
                    <MessageSquare className="w-6 h-6" />
                </Button>
            )}
        </div>
    );
};

export default PropertyChatbot;
