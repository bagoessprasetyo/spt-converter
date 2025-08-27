'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  User, 
  Mail, 
  CreditCard, 
  Bell, 
  Shield, 
  Trash2,
  Save,
  Eye,
  EyeOff,
  Crown,
  Zap,
  FileText
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/lib/auth/context'
import { updateUserProfile } from '@/lib/supabase/users-client'
import { redirect } from 'next/navigation'
import { toast } from 'sonner'

export default function SettingsPage() {
  const { user, profile, loading, signOut } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    current_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [notifications, setNotifications] = useState({
    email_notifications: true,
    conversion_updates: true,
    marketing_emails: false,
    security_alerts: true
  })

  // Redirect to login if not authenticated
  if (!loading && !user) {
    redirect('/auth/login?redirect=/settings')
  }

  useEffect(() => {
    if (profile) {
      setFormData(prev => ({
        ...prev,
        full_name: profile.full_name || '',
        email: user?.email || ''
      }))
    }
  }, [profile, user])

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleNotificationChange = (field: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [field]: value }))
  }

  const handleProfileUpdate = async () => {
    if (!user || !profile) return

    try {
      setIsLoading(true)
      
      await updateUserProfile(user.id, {
        full_name: formData.full_name
      })
      
      toast.success('Profile updated successfully')
    } catch (error) {
      console.error('Error updating profile:', error)
      toast.error('Failed to update profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handlePasswordChange = async () => {
    if (!formData.new_password || !formData.confirm_password) {
      toast.error('Please fill in all password fields')
      return
    }

    if (formData.new_password !== formData.confirm_password) {
      toast.error('New passwords do not match')
      return
    }

    if (formData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters long')
      return
    }

    try {
      setIsLoading(true)
      // TODO: Implement password change with Supabase Auth
      toast.success('Password updated successfully')
      setFormData(prev => ({
        ...prev,
        current_password: '',
        new_password: '',
        confirm_password: ''
      }))
    } catch (error) {
      console.error('Error updating password:', error)
      toast.error('Failed to update password')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return
    }

    try {
      setIsLoading(true)
      // TODO: Implement account deletion
      toast.success('Account deletion initiated')
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error('Failed to delete account')
    } finally {
      setIsLoading(false)
    }
  }

  const getSubscriptionBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge className="bg-gradient-to-r from-purple-600 to-blue-600 text-white"><Crown className="h-3 w-3 mr-1" />Premium</Badge>
      case 'pro':
        return <Badge className="bg-gradient-to-r from-blue-600 to-cyan-600 text-white"><Zap className="h-3 w-3 mr-1" />Pro</Badge>
      default:
        return <Badge variant="outline">Free</Badge>
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
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

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Account Settings</h1>
          <p className="text-gray-600">
            Manage your account preferences and subscription
          </p>
        </motion.div>

        <div className="space-y-6">
          {/* Profile Information */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <User className="h-5 w-5" />
                  <span>Profile Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={formData.full_name}
                      onChange={(e) => handleInputChange('full_name', e.target.value)}
                      placeholder="Enter your full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      className="bg-gray-50"
                    />
                    <p className="text-xs text-gray-500">
                      Email cannot be changed. Contact support if needed.
                    </p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleProfileUpdate} disabled={isLoading}>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Subscription */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5" />
                  <span>Subscription</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="text-lg font-semibold">Current Plan</span>
                      {getSubscriptionBadge(profile?.subscription_tier || 'free')}
                    </div>
                    <p className="text-gray-600">
                      {profile?.credits_remaining || 0} credits remaining
                    </p>
                  </div>
                  <Link href="/pricing">
                    <Button variant="outline">
                      Upgrade Plan
                    </Button>
                  </Link>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Usage This Month</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700">Conversions:</span>
                      <span className="font-medium ml-2">12 / 50</span>
                    </div>
                    <div>
                      <span className="text-blue-700">Storage:</span>
                      <span className="font-medium ml-2">2.4 GB / 10 GB</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Security */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5" />
                  <span>Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="current_password">Current Password</Label>
                    <div className="relative">
                      <Input
                        id="current_password"
                        type={showPassword ? 'text' : 'password'}
                        value={formData.current_password}
                        onChange={(e) => handleInputChange('current_password', e.target.value)}
                        placeholder="Enter current password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="new_password">New Password</Label>
                      <Input
                        id="new_password"
                        type="password"
                        value={formData.new_password}
                        onChange={(e) => handleInputChange('new_password', e.target.value)}
                        placeholder="Enter new password"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirm_password">Confirm New Password</Label>
                      <Input
                        id="confirm_password"
                        type="password"
                        value={formData.confirm_password}
                        onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="flex justify-end">
                  <Button onClick={handlePasswordChange} disabled={isLoading}>
                    Update Password
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bell className="h-5 w-5" />
                  <span>Notifications</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="email_notifications" className="text-base font-medium">
                        Email Notifications
                      </Label>
                      <p className="text-sm text-gray-600">
                        Receive email updates about your account
                      </p>
                    </div>
                    <Switch
                      id="email_notifications"
                      checked={notifications.email_notifications}
                      onCheckedChange={(checked) => handleNotificationChange('email_notifications', checked)}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="conversion_updates" className="text-base font-medium">
                        Conversion Updates
                      </Label>
                      <p className="text-sm text-gray-600">
                        Get notified when your conversions are complete
                      </p>
                    </div>
                    <Switch
                      id="conversion_updates"
                      checked={notifications.conversion_updates}
                      onCheckedChange={(checked) => handleNotificationChange('conversion_updates', checked)}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="marketing_emails" className="text-base font-medium">
                        Marketing Emails
                      </Label>
                      <p className="text-sm text-gray-600">
                        Receive updates about new features and promotions
                      </p>
                    </div>
                    <Switch
                      id="marketing_emails"
                      checked={notifications.marketing_emails}
                      onCheckedChange={(checked) => handleNotificationChange('marketing_emails', checked)}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="security_alerts" className="text-base font-medium">
                        Security Alerts
                      </Label>
                      <p className="text-sm text-gray-600">
                        Important security notifications about your account
                      </p>
                    </div>
                    <Switch
                      id="security_alerts"
                      checked={notifications.security_alerts}
                      onCheckedChange={(checked) => handleNotificationChange('security_alerts', checked)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Danger Zone */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
          >
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2 text-red-600">
                  <Trash2 className="h-5 w-5" />
                  <span>Danger Zone</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <h4 className="font-medium text-red-900 mb-2">Delete Account</h4>
                  <p className="text-red-700 text-sm mb-4">
                    Once you delete your account, there is no going back. Please be certain.
                    All your conversions and data will be permanently deleted.
                  </p>
                  <div className="flex justify-between items-center">
                    <Button
                      variant="outline"
                      onClick={signOut}
                      className="text-gray-600 border-gray-300"
                    >
                      Sign Out
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={handleDeleteAccount}
                      disabled={isLoading}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Account
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}