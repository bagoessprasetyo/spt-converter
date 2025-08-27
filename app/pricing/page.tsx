'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Check, 
  X, 
  Crown, 
  Zap, 
  FileText,
  Users,
  Shield,
  Clock,
  Download,
  Star
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'

interface PricingTier {
  id: string
  name: string
  description: string
  monthlyPrice: number
  yearlyPrice: number
  credits: number
  maxFileSize: string
  features: string[]
  limitations: string[]
  popular?: boolean
  icon: React.ReactNode
  gradient: string
}

const pricingTiers: PricingTier[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Perfect for trying out our service',
    monthlyPrice: 0,
    yearlyPrice: 0,
    credits: 10,
    maxFileSize: '5MB',
    features: [
      '10 conversions per month',
      'Files up to 5MB',
      'Basic PDF to Excel conversion',
      'Email support',
      '24-hour file retention'
    ],
    limitations: [
      'Limited to 10 conversions/month',
      'Basic conversion quality',
      'No priority support',
      'Files deleted after 24 hours'
    ],
    icon: <FileText className="h-6 w-6" />,
    gradient: 'from-gray-500 to-gray-600'
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'Great for professionals and small teams',
    monthlyPrice: 19,
    yearlyPrice: 190,
    credits: 500,
    maxFileSize: '50MB',
    features: [
      '500 conversions per month',
      'Files up to 50MB',
      'Advanced conversion algorithms',
      'Priority email support',
      '7-day file retention',
      'Batch processing',
      'API access',
      'Custom formatting options'
    ],
    limitations: [
      'Limited to 500 conversions/month',
      'Email support only'
    ],
    popular: true,
    icon: <Zap className="h-6 w-6" />,
    gradient: 'from-blue-500 to-cyan-500'
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'For power users and large organizations',
    monthlyPrice: 49,
    yearlyPrice: 490,
    credits: 2000,
    maxFileSize: '200MB',
    features: [
      'Unlimited conversions',
      'Files up to 200MB',
      'Premium conversion quality',
      '24/7 priority support',
      '30-day file retention',
      'Advanced batch processing',
      'Full API access',
      'Custom integrations',
      'White-label options',
      'Dedicated account manager'
    ],
    limitations: [],
    icon: <Crown className="h-6 w-6" />,
    gradient: 'from-purple-500 to-pink-500'
  }
]

const features = [
  {
    name: 'Monthly Conversions',
    free: '10',
    pro: '500',
    premium: 'Unlimited'
  },
  {
    name: 'Max File Size',
    free: '5MB',
    pro: '50MB',
    premium: '200MB'
  },
  {
    name: 'File Retention',
    free: '24 hours',
    pro: '7 days',
    premium: '30 days'
  },
  {
    name: 'Batch Processing',
    free: false,
    pro: true,
    premium: true
  },
  {
    name: 'API Access',
    free: false,
    pro: 'Basic',
    premium: 'Full'
  },
  {
    name: 'Priority Support',
    free: false,
    pro: true,
    premium: true
  },
  {
    name: 'Custom Formatting',
    free: false,
    pro: true,
    premium: true
  },
  {
    name: 'White-label',
    free: false,
    pro: false,
    premium: true
  },
  {
    name: 'Dedicated Manager',
    free: false,
    pro: false,
    premium: true
  }
]

export default function PricingPage() {
  const [isYearly, setIsYearly] = useState(false)

  const getPrice = (tier: PricingTier) => {
    return isYearly ? tier.yearlyPrice : tier.monthlyPrice
  }

  const getSavings = (tier: PricingTier) => {
    if (tier.monthlyPrice === 0) return 0
    const monthlyTotal = tier.monthlyPrice * 12
    const savings = monthlyTotal - tier.yearlyPrice
    return Math.round((savings / monthlyTotal) * 100)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PDF to Excel</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost">Home</Button>
              </Link>
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Link href="/convert">
                <Button>Convert Files</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose Your <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">Perfect Plan</span>
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
            Transform your PDFs into Excel files with our powerful conversion tools. 
            Start free and upgrade as you grow.
          </p>
          
          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-8">
            <Label htmlFor="billing-toggle" className={`text-lg ${!isYearly ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
              Monthly
            </Label>
            <Switch
              id="billing-toggle"
              checked={isYearly}
              onCheckedChange={setIsYearly}
              className="data-[state=checked]:bg-green-500"
            />
            <div className="flex items-center space-x-2">
              <Label htmlFor="billing-toggle" className={`text-lg ${isYearly ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                Yearly
              </Label>
              <Badge className="bg-green-100 text-green-800 border-green-200">
                Save up to 20%
              </Badge>
            </div>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          {pricingTiers.map((tier, index) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className={`relative ${tier.popular ? 'scale-105' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1">
                    <Star className="h-3 w-3 mr-1" />
                    Most Popular
                  </Badge>
                </div>
              )}
              
              <Card className={`h-full ${tier.popular ? 'border-blue-200 shadow-xl' : 'border-gray-200'} hover:shadow-lg transition-shadow duration-300`}>
                <CardHeader className="text-center pb-4">
                  <div className={`w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-r ${tier.gradient} flex items-center justify-center text-white`}>
                    {tier.icon}
                  </div>
                  <CardTitle className="text-2xl font-bold">{tier.name}</CardTitle>
                  <p className="text-gray-600">{tier.description}</p>
                  
                  <div className="mt-4">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900">
                        ${getPrice(tier)}
                      </span>
                      {tier.monthlyPrice > 0 && (
                        <span className="text-gray-500 ml-1">
                          /{isYearly ? 'year' : 'month'}
                        </span>
                      )}
                    </div>
                    {isYearly && tier.monthlyPrice > 0 && getSavings(tier) > 0 && (
                      <p className="text-green-600 text-sm mt-1">
                        Save {getSavings(tier)}% annually
                      </p>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pt-0">
                  <div className="space-y-4 mb-6">
                    <div className="text-center">
                      <span className="text-2xl font-bold text-blue-600">{tier.credits}</span>
                      <span className="text-gray-600 ml-1">
                        {tier.credits === 2000 ? 'credits/month' : 'credits/month'}
                      </span>
                    </div>
                    
                    <div className="text-center text-sm text-gray-600">
                      Max file size: <span className="font-medium">{tier.maxFileSize}</span>
                    </div>
                  </div>
                  
                  <ul className="space-y-3 mb-6">
                    {tier.features.map((feature, featureIndex) => (
                      <li key={featureIndex} className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {tier.limitations.length > 0 && (
                    <ul className="space-y-2 mb-6">
                      {tier.limitations.map((limitation, limitIndex) => (
                        <li key={limitIndex} className="flex items-start space-x-3">
                          <X className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
                          <span className="text-gray-500 text-sm">{limitation}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  
                  <Button 
                    className={`w-full ${tier.popular 
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700' 
                      : tier.id === 'free' 
                        ? 'bg-gray-600 hover:bg-gray-700' 
                        : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    size="lg"
                  >
                    {tier.id === 'free' ? 'Get Started Free' : `Choose ${tier.name}`}
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Feature Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Compare All Features
          </h2>
          
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-medium text-gray-900">Features</th>
                    <th className="px-6 py-4 text-center text-sm font-medium text-gray-900">Free</th>
                    <th className="px-6 py-4 text-center text-sm font-medium text-gray-900 bg-blue-50">
                      Pro
                      <Badge className="ml-2 bg-blue-100 text-blue-800">Popular</Badge>
                    </th>
                    <th className="px-6 py-4 text-center text-sm font-medium text-gray-900">Premium</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {features.map((feature, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {feature.name}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-700">
                        {typeof feature.free === 'boolean' ? (
                          feature.free ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          feature.free
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-700 bg-blue-50">
                        {typeof feature.pro === 'boolean' ? (
                          feature.pro ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          feature.pro
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-700">
                        {typeof feature.premium === 'boolean' ? (
                          feature.premium ? (
                            <Check className="h-5 w-5 text-green-500 mx-auto" />
                          ) : (
                            <X className="h-5 w-5 text-gray-400 mx-auto" />
                          )
                        ) : (
                          feature.premium
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </motion.div>

        {/* FAQ Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mb-16"
        >
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-8">
            Frequently Asked Questions
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Can I change my plan anytime?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Yes! You can upgrade or downgrade your plan at any time. Changes take effect immediately, 
                  and we'll prorate any billing differences.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What happens to my files?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Files are automatically deleted based on your plan's retention period. 
                  Free users get 24 hours, Pro users get 7 days, and Premium users get 30 days.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Do you offer refunds?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  We offer a 30-day money-back guarantee for all paid plans. 
                  If you're not satisfied, contact us for a full refund.
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Is there an API available?</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Yes! Pro users get basic API access, while Premium users get full API access 
                  with higher rate limits and advanced features.
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="text-center"
        >
          <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
            <CardContent className="py-12">
              <h2 className="text-3xl font-bold mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-xl mb-8 opacity-90">
                Join thousands of users who trust us with their PDF conversions
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/auth/register">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100">
                    Start Free Trial
                  </Button>
                </Link>
                <Link href="/convert">
                  <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                    Try Demo
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}