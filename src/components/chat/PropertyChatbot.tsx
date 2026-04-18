import { useState, useRef, useEffect } from "react";
import { MessageSquare, X, Send, Building2, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { notifyNewBooking } from "@/utils/n8nService";
import { logAppointmentCreation } from "@/utils/auditLog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuickReply {
    label: string;
    value: string;
}

interface ChatProperty {
    property_id: number;
    property_type: string;
    location: string;
    rental_price: number;
    num_bedroom: number;
    num_bathroom: number;
    property_size: number | null;
    description: string | null;
    availability_status: string;
    images: string[] | null;
}

interface Message {
    id: string;
    role: "user" | "bot";
    content: string;
    relatedProperties?: ChatProperty[];
    quickReplies?: QuickReply[];
}

type BookingStep = "idle" | "select_property" | "select_date" | "select_slot" | "confirm";

interface BookingContext {
    step: BookingStep;
    property?: {
        property_id: number;
        property_type: string;
        location: string;
    };
    date?: string;
    time?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_TIME_SLOTS = ["09:00 AM", "10:00 AM", "11:00 AM", "02:00 PM", "03:00 PM", "04:00 PM"];

const BOOKING_KEYWORDS = ["book", "appointment", "schedule", "viewing", "visit", "arrange"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const extractSearchCriteria = (text: string) => {
    try {
        if (!text) return {};
        const criteria: any = {};
        const lower = text.toLowerCase();

        const bedMatch = lower.match(/(\d+)\s*(?:bed|room)/);
        if (bedMatch) criteria.minBeds = parseInt(bedMatch[1]);

        const priceMatch =
            lower.match(/(?:under|rm|max|budget)\s*(\d+)/) ||
            lower.match(/<\s*(\d+)/);
        if (priceMatch) criteria.maxPrice = parseInt(priceMatch[1]);

        const types = ["apartment", "condo", "condominium", "terrace", "flat", "bungalow", "semi-d", "house"];
        const foundType = types.find((t) => lower.includes(t));
        if (foundType) criteria.type = foundType === "condo" ? "condominium" : foundType;

        const locations = ["johor bahru", "jb", "skudai", "mount austin", "pasir gudang", "kulai", "muar", "batu pahat"];
        const foundLoc = locations.find((l) => lower.includes(l));
        if (foundLoc) criteria.location = foundLoc;

        return criteria;
    } catch {
        return {};
    }
};

const isBookingIntent = (text: string) =>
    BOOKING_KEYWORDS.some((k) => text.toLowerCase().includes(k));

/**
 * Accepts ISO dates (2026-03-15), "March 15", "15 March", "15/3/2026", etc.
 * Returns { date: ISO string } on success, { error: "past" | "invalid" } on failure.
 */
const parseDate = (text: string): { date: string } | { error: "past" | "invalid" } => {
    const trimmed = text.trim();
    const todayStr = new Date().toISOString().split("T")[0]; // compare dates only

    // ISO format: 2026-03-15
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        const d = new Date(trimmed);
        if (isNaN(d.getTime())) return { error: "invalid" };
        return trimmed >= todayStr ? { date: trimmed } : { error: "past" };
    }

    // Try "March 15" or "15 March" — append current year if missing
    const currentYear = new Date().getFullYear();
    const withYear = /\d{4}/.test(trimmed) ? trimmed : `${trimmed} ${currentYear}`;
    const parsed = new Date(withYear);
    if (isNaN(parsed.getTime())) return { error: "invalid" };

    const iso = parsed.toISOString().split("T")[0];
    return iso >= todayStr ? { date: iso } : { error: "past" };
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const PropertyChatbot = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState("");
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "welcome",
            role: "bot",
            content:
                "Hi! I'm your PropertyPal AI assistant.\n\nSearch for properties (e.g. '3 bedroom apartment in JB under RM 2000') or say 'book appointment' after finding a property to schedule a viewing!",
        },
    ]);
    const [isTyping, setIsTyping] = useState(false);
    const [booking, setBooking] = useState<BookingContext>({ step: "idle" });
    const [tenantId, setTenantId] = useState<number | null>(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isOpen]);

    useEffect(() => {
        if (isOpen) checkAuth();
    }, [isOpen]);

    // Keep auth state in sync with Supabase session changes (login/logout)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                setIsAuthenticated(true);
                supabase
                    .from("tenant")
                    .select("tenant_id")
                    .eq("user_id", session.user.id)
                    .maybeSingle()
                    .then(({ data }) => {
                        setTenantId(data?.tenant_id ?? null);
                    });
            } else {
                setIsAuthenticated(false);
                setTenantId(null);
                setBooking({ step: "idle" });
            }
        });
        return () => subscription.unsubscribe();
    }, []);

    const checkAuth = async () => {
        const {
            data: { session },
        } = await supabase.auth.getSession();
        if (session?.user) {
            setIsAuthenticated(true);
            // Pre-fetch tenantId so booking can proceed without extra round-trip
            const { data } = await supabase
                .from("tenant")
                .select("tenant_id")
                .eq("user_id", session.user.id)
                .maybeSingle();
            if (data) setTenantId(data.tenant_id);
        }
    };

    // ---------------------------------------------------------------------------
    // Message helpers
    // ---------------------------------------------------------------------------

    const addBotMessage = (content: string, extras?: Partial<Message>) => {
        setMessages((prev) => [
            ...prev,
            { id: Date.now().toString(), role: "bot", content, ...extras },
        ]);
    };

    // ---------------------------------------------------------------------------
    // Booking flow
    // ---------------------------------------------------------------------------

    /** Called when user sends a message with booking intent. */
    const startBookingFlow = async (recentProperties: ChatProperty[]) => {
        if (!isAuthenticated) {
            addBotMessage(
                "You need to be logged in to book a viewing appointment.",
                {
                    quickReplies: [{ label: "Go to Login", value: "goto_login" }],
                }
            );
            return;
        }
        if (!tenantId) {
            addBotMessage(
                "Only tenant accounts can book appointments. Please log in with a tenant account."
            );
            return;
        }
        if (recentProperties.length === 0) {
            addBotMessage(
                "Please search for a property first, then say 'book appointment' and I'll help you schedule a viewing!\n\nTry: '2 bedroom apartment in JB'"
            );
            return;
        }

        setBooking({ step: "select_property" });
        addBotMessage("Which property would you like to book a viewing for?", {
            quickReplies: recentProperties.slice(0, 5).map((p) => ({
                label: `${p.property_type} — ${p.location} (RM ${p.rental_price})`,
                value: `prop_${p.property_id}`,
            })),
        });
    };

    /** Returns available time slots for a property on a given date. */
    const getAvailableSlots = async (propertyId: number, date: string): Promise<string[]> => {
        const { data } = await supabase
            .from("appointment")
            .select("appointment_time")
            .eq("property_id", propertyId)
            .eq("appointment_date", date)
            .not("status", "eq", "cancelled")
            .not("status", "eq", "rejected");

        const booked = (data || []).map((a) => a.appointment_time);
        return ALL_TIME_SLOTS.filter((slot) => !booked.includes(slot));
    };

    /** Creates the appointment record in Supabase and triggers n8n. */
    const createAppointment = async (
        propertyId: number,
        date: string,
        time: string
    ) => {
        // Fetch owner_id server-side to avoid relying on client-supplied data
        const { data: propData, error: propError } = await supabase
            .from("property")
            .select("owner_id")
            .eq("property_id", propertyId)
            .single();

        if (propError || !propData) throw propError || new Error("Property not found");

        const { data, error } = await supabase
            .from("appointment")
            .insert({
                appointment_date: date,
                appointment_time: time,
                status: "pending",
                tenant_id: tenantId,
                property_id: propertyId,
                owner_id: propData.owner_id,
            })
            .select("appointment_id")
            .single();

        if (error) throw error;
        return data;
    };

    // ---------------------------------------------------------------------------
    // Quick-reply button handler
    // ---------------------------------------------------------------------------

    const handleQuickReply = async (value: string) => {
        if (value === "goto_login") {
            window.location.href = "/auth";
            return;
        }

        if (value === "cancel_booking") {
            setBooking({ step: "idle" });
            addBotMessage("Booking cancelled. Is there anything else I can help you with?");
            return;
        }

        // Property selection
        if (value.startsWith("prop_") && booking.step === "select_property") {
            const propertyId = parseInt(value.replace("prop_", ""));
            const allProps = messages.flatMap((m) => m.relatedProperties || []);
            const selected = allProps.find((p) => p.property_id === propertyId);
            if (!selected) return;

            setBooking({
                step: "select_date",
                property: {
                    property_id: selected.property_id,
                    property_type: selected.property_type,
                    location: selected.location,
                },
            });

            addBotMessage(
                `Great choice! 🏠 ${selected.property_type} at ${selected.location}\n\nWhat date would you like to visit? Type it like:\n• 2026-03-15\n• March 15\n• 15 March\n\n(Must be a future date)`
            );
            return;
        }

        // Time slot selection
        if (booking.step === "select_slot") {
            setBooking((prev) => ({ ...prev, step: "confirm", time: value }));
            addBotMessage(
                `Please confirm your appointment:\n\n📍 ${booking.property?.property_type} at ${booking.property?.location}\n📅 ${booking.date}\n⏰ ${value}\n\nShall I book this for you?`,
                {
                    quickReplies: [
                        { label: "Yes, Book It!", value: "confirm_yes" },
                        { label: "No, Cancel", value: "cancel_booking" },
                    ],
                }
            );
            return;
        }

        // Final confirmation
        if (value === "confirm_yes" && booking.step === "confirm") {
            if (!booking.property || !booking.date || !booking.time || !tenantId) return;

            setIsTyping(true);
            try {
                const newAppt = await createAppointment(
                    booking.property.property_id,
                    booking.date,
                    booking.time
                );

                await logAppointmentCreation(
                    newAppt.appointment_id.toString(),
                    booking.property.property_id.toString()
                );

                // Fire-and-forget: trigger n8n to send confirmation emails
                notifyNewBooking(newAppt.appointment_id);

                setBooking({ step: "idle" });
                addBotMessage(
                    `✅ Appointment booked!\n\n📍 ${booking.property.property_type} at ${booking.property.location}\n📅 ${booking.date} at ${booking.time}\n\nYour request is pending owner approval. You'll receive an email confirmation shortly. Track your appointment in your dashboard.`
                );
            } catch (err: any) {
                addBotMessage(`Sorry, booking failed: ${err.message}. Please try again.`);
            } finally {
                setIsTyping(false);
            }
        }
    };

    // ---------------------------------------------------------------------------
    // Date input handler (called when booking.step === "select_date")
    // ---------------------------------------------------------------------------

    const handleBookingDateInput = async (text: string) => {
        const result = parseDate(text);
        if ("error" in result) {
            addBotMessage(
                result.error === "past"
                    ? "That date is in the past. Please pick a future date."
                    : "I couldn't understand that date. Please use a format like 2026-04-15 or 'April 15'."
            );
            return;
        }
        const date = result.date;

        setIsTyping(true);
        try {
            const available = await getAvailableSlots(booking.property!.property_id, date);

            if (available.length === 0) {
                addBotMessage(
                    `No available time slots on ${date} for this property. Would you like to try a different date?`,
                    {
                        quickReplies: [{ label: "Cancel Booking", value: "cancel_booking" }],
                    }
                );
                return;
            }

            setBooking((prev) => ({ ...prev, step: "select_slot", date }));
            addBotMessage(`Available times on ${date}. Pick a slot:`, {
                quickReplies: available.map((slot) => ({ label: slot, value: slot })),
            });
        } catch {
            addBotMessage("Sorry, I couldn't check availability. Please try again.");
        } finally {
            setIsTyping(false);
        }
    };

    // ---------------------------------------------------------------------------
    // Main send handler
    // ---------------------------------------------------------------------------

    const handleSend = async () => {
        if (!inputValue.trim()) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            role: "user",
            content: inputValue,
        };
        setMessages((prev) => [...prev, userMsg]);
        setInputValue("");

        // Waiting for a date — route directly to date handler
        if (booking.step === "select_date") {
            await handleBookingDateInput(inputValue);
            return;
        }

        // Booking intent detected — start booking flow
        if (isBookingIntent(inputValue)) {
            const recentProps = messages.flatMap((m) => m.relatedProperties || []);
            await startBookingFlow(recentProps);
            return;
        }

        // Normal property search
        setIsTyping(true);
        try {
            const criteria = extractSearchCriteria(userMsg.content);
            let query = supabase
                .from("property")
                .select(
                    "property_id, property_type, location, rental_price, num_bedroom, num_bathroom, property_size, description, availability_status, images"
                );

            if (criteria.minBeds) query = query.gte("num_bedroom", criteria.minBeds);
            if (criteria.maxPrice) query = query.lte("rental_price", criteria.maxPrice);
            if (criteria.type) query = query.ilike("property_type", `%${criteria.type}%`);
            if (criteria.location) query = query.ilike("location", `%${criteria.location}%`);

            const { data, error } = await query.eq("availability_status", "Available").limit(3);
            if (error) throw error;

            const botContent =
                data && data.length > 0
                    ? `I found ${data.length} ${data.length === 1 ? "property" : "properties"}! Say 'book appointment' to schedule a viewing.`
                    : "I couldn't find any properties matching that description. Try broadening your search?";

            addBotMessage(botContent, { relatedProperties: data || [] });
        } catch {
            addBotMessage("Sorry, I encountered an error while searching. Please try again.");
        } finally {
            setIsTyping(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") handleSend();
    };

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    const propertyLinkTarget = isAuthenticated ? "/tenant/properties" : "/auth";

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat window */}
            {isOpen && (
                <Card className="w-80 md:w-96 h-[540px] mb-4 shadow-2xl border-primary/20 flex flex-col animate-in slide-in-from-bottom-5 fade-in duration-300">
                    {/* Header */}
                    <div className="p-4 bg-primary text-primary-foreground rounded-t-lg flex justify-between items-center flex-shrink-0">
                        <div className="flex items-center gap-2">
                            <span className="font-semibold">PropertyPal AI</span>
                            {booking.step !== "idle" && (
                                <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                    Booking
                                </span>
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-primary-foreground hover:bg-primary/90"
                            onClick={() => setIsOpen(false)}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>

                    {/* Messages */}
                    <ScrollArea className="flex-1 p-4 bg-muted/30">
                        <div className="space-y-4">
                            {messages.map((msg) => (
                                <div
                                    key={msg.id}
                                    className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                                >
                                    <div className={`max-w-[85%] ${msg.role === "bot" ? "space-y-2" : ""}`}>
                                        {/* Bubble */}
                                        <div
                                            className={`rounded-2xl px-4 py-2 ${
                                                msg.role === "user"
                                                    ? "bg-primary text-primary-foreground rounded-br-none"
                                                    : "bg-card border shadow-sm rounded-bl-none"
                                            }`}
                                        >
                                            <p className="text-sm whitespace-pre-line">{msg.content}</p>

                                            {/* Property cards */}
                                            {msg.relatedProperties && msg.relatedProperties.length > 0 && (
                                                <div className="mt-3 space-y-2">
                                                    {msg.relatedProperties.map((prop) => (
                                                        <Link
                                                            to={propertyLinkTarget}
                                                            key={prop.property_id}
                                                            className="block group"
                                                        >
                                                            <div className="bg-background/50 p-2 rounded border hover:border-primary transition-colors flex gap-2">
                                                                <div className="h-12 w-12 bg-muted rounded overflow-hidden flex-shrink-0">
                                                                    {prop.images && prop.images[0] ? (
                                                                        <img
                                                                            src={prop.images[0]}
                                                                            alt="Property"
                                                                            className="h-full w-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <Building2 className="p-2 h-full w-full text-muted-foreground" />
                                                                    )}
                                                                </div>
                                                                <div className="overflow-hidden">
                                                                    <p className="text-xs font-semibold truncate group-hover:text-primary">
                                                                        {prop.property_type}
                                                                    </p>
                                                                    <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                                                        <MapPin className="w-3 h-3" />
                                                                        {prop.location}
                                                                    </p>
                                                                    <p className="text-xs font-bold text-primary mt-1">
                                                                        RM {prop.rental_price}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </Link>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Quick-reply buttons */}
                                        {msg.role === "bot" &&
                                            msg.quickReplies &&
                                            msg.quickReplies.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {msg.quickReplies.map((qr) => (
                                                        <button
                                                            key={qr.value}
                                                            onClick={() => handleQuickReply(qr.value)}
                                                            className="text-xs px-3 py-1.5 rounded-full border border-primary/40 text-primary bg-primary/5 hover:bg-primary/15 transition-colors"
                                                        >
                                                            {qr.label}
                                                        </button>
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

                    {/* Input */}
                    <div className="p-3 border-t bg-background rounded-b-lg flex gap-2 flex-shrink-0">
                        <Input
                            placeholder={
                                booking.step === "select_date"
                                    ? "Enter a date (e.g. 2026-03-15)..."
                                    : "Search properties or say 'book appointment'..."
                            }
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="flex-1"
                            disabled={isTyping}
                        />
                        <Button
                            size="icon"
                            onClick={handleSend}
                            disabled={!inputValue.trim() || isTyping}
                        >
                            <Send className="w-4 h-4" />
                        </Button>
                    </div>
                </Card>
            )}

            {/* Toggle button */}
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
