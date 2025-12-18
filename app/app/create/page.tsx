"use client"

import { useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { motion } from "motion/react"
import { Calendar, Clock, Trophy, DollarSign, Wallet as WalletIcon, Loader2 } from "lucide-react" 
import { useRouter } from "next/navigation"
import { BN } from "@coral-xyz/anchor"

import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { useWallet } from '@solana/wallet-adapter-react'
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { initializeStream, getProvider, getNextStreamId } from '@/services/service'

const formSchema = z.object({
  stream_id: z.string().min(1, {
    message: "A valid YouTube URL is required.",
  }).refine((url) => !url.includes("/live/"), {
    message: "Please use a standard YouTube video link, not a Live Stream link.",
  }),
  team_a_name: z.string().min(2, {
    message: "Team A name must be at least 2 characters.",
  }),
  team_b_name: z.string().min(2, {
    message: "Team B name must be at least 2 characters.",
  }),
  initial_price: z.coerce.number().min(0.01, {
    message: "Price must be at least 0.01 SOL.",
  }),
  stream_duration: z.coerce.number().min(1, {
    message: "Duration must be at least 1 minute.",
  }),
})

// Helper to extract YouTube ID
const getYoutubeId = (url: string) => {
  // Regex to match standard video IDs (v=...) or short URLs (youtu.be/...)
  // Explicitly avoids /live/ path due to validation above, but good to be precise
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export default function CreateStreamPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const { publicKey, sendTransaction, signTransaction } = useWallet()

  const program = useMemo(
    () => getProvider(publicKey, signTransaction, sendTransaction),
    [publicKey, signTransaction, sendTransaction]
  )

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      stream_id: "",
      team_a_name: "",
      team_b_name: "",
      initial_price: 0.1,
      stream_duration: 60,
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    // Validate YouTube URL and extract video ID
    const youtubeUrl = values.stream_id;
    const videoId = getYoutubeId(youtubeUrl);
    
    if (!videoId) {
      form.setError("stream_id", { 
        type: "manual", 
        message: "Could not extract a valid YouTube Video ID." 
      });
      return;
    }

    // Check if wallet is connected
    if (!publicKey || !program) {
      alert("Please connect your wallet first!");
      return;
    }

    setIsLoading(true);

    try {
      // Get the next stream ID (incrementing counter)
      const streamId = await getNextStreamId(program);
      const nextStreamIdNumber = streamId.toString();
      
      // Convert form values to BN for Solana program
      const initialPrice = new BN(values.initial_price * LAMPORTS_PER_SOL);
      const streamDuration = new BN(values.stream_duration * 60);
      
      console.log("Initializing stream with params:", {
        streamId: streamId.toString(),
        teamAName: values.team_a_name,
        teamBName: values.team_b_name,
        initialPrice: initialPrice.toString(),
        streamDuration: streamDuration.toString(),
        streamLink: youtubeUrl
      });

      // Call the initializeStream function
      const signature = await initializeStream(
        program,
        { publicKey } as any,
        streamId,
        values.team_a_name,
        values.team_b_name,
        initialPrice,
        streamDuration,
        youtubeUrl
      );

      console.log("Stream created successfully! Transaction signature:", signature);
      
      alert(`Stream Created Successfully!\nStream ID: ${nextStreamIdNumber}\nTransaction: ${signature}`);
      
      // Redirect to streams page
      router.push("/streams");

    } catch (error: any) {
      console.error("Error creating stream:", error);
      
      // Parse error message for user-friendly display
      let errorMessage = "Failed to create stream. ";
      if (error.message) {
        errorMessage += error.message;
      } else {
        errorMessage += "Please try again.";
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 pt-24 pb-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl"
      >
        <Card className="border-2 border-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] bg-white rounded-none">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-zinc-900 font-mono uppercase tracking-widest flex items-center gap-2">
              <Trophy className="w-6 h-6 text-blue-600" />
              <span>Initialize Stream</span>
            </CardTitle>
            <CardDescription className="text-zinc-500 font-mono text-xs uppercase tracking-wider">
              Configure parameters for new prediction stream
            </CardDescription>
          </CardHeader>
          <Separator className="bg-zinc-900 h-0.5" />
          <CardContent className="pt-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                
                {/* YouTube Link / Stream ID */}
                <FormField
                  control={form.control}
                  name="stream_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-zinc-700 font-semibold">YouTube Stream Link</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <WalletIcon className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                          <Input 
                            placeholder="https://www.youtube.com/watch?v=..." 
                            className="pl-9 bg-zinc-50 border-2 border-zinc-300 focus:border-zinc-900 focus:ring-0 rounded-none font-mono" 
                            {...field}
                            disabled={isLoading}
                          />
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs text-zinc-400">
                        Paste the YouTube Link for the stream.
                        {field.value && getYoutubeId(field.value) && (
                          <span className="block mt-1 text-blue-600 font-medium">
                            Extracted Video ID: {getYoutubeId(field.value)}
                          </span>
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Team A */}
                  <FormField
                    control={form.control}
                    name="team_a_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 font-semibold">Team A Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Cyber Dragons" className="bg-zinc-50 border-2 border-zinc-300 focus:border-zinc-900 focus:ring-0 rounded-none font-mono" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Team B */}
                  <FormField
                    control={form.control}
                    name="team_b_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 font-semibold">Team B Name</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. Neon Tigers" className="bg-zinc-50 border-2 border-zinc-300 focus:border-zinc-900 focus:ring-0 rounded-none font-mono" {...field} disabled={isLoading} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Initial Price */}
                  <FormField
                    control={form.control}
                    name="initial_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 font-semibold">Initial Price (SOL)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                            <Input placeholder="0.1" type="number" step="0.000000001" className="pl-9 bg-zinc-50 border-2 border-zinc-300 focus:border-zinc-900 focus:ring-0 rounded-none font-mono" {...field} disabled={isLoading} />
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs text-zinc-400">
                          Starting price for the prediction token in SOL.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Duration */}
                  <FormField
                    control={form.control}
                    name="stream_duration"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-zinc-700 font-semibold">Duration (minutes)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Clock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                            <Input placeholder="60" type="number" className="pl-9 bg-zinc-50 border-2 border-zinc-300 focus:border-zinc-900 focus:ring-0 rounded-none font-mono" {...field} disabled={isLoading} />
                          </div>
                        </FormControl>
                        <FormDescription className="text-xs text-zinc-400">
                          Duration of the stream in minutes.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {!publicKey && (
                  <div className="bg-yellow-50 border-2 border-yellow-400 p-4 rounded-none">
                    <p className="text-sm text-yellow-800 font-mono">
                      ⚠️ Please connect your wallet to create a stream
                    </p>
                  </div>
                )}

                <div className="pt-4">
                  <Button 
                    type="submit" 
                    disabled={isLoading || !publicKey}
                    className="w-full bg-zinc-900 hover:bg-zinc-800 text-white font-bold py-6 text-lg rounded-none border-2 border-zinc-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all uppercase tracking-widest disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>Processing...</span>
                      </div>
                    ) : (
                      "Create Stream"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}