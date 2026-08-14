Pod::Spec.new do |s|
  s.name           = 'LifeMoonshineDictation'
  s.version        = '1.0.0'
  s.summary        = 'Moonshine Voice note dictation for Life Dashboard'
  s.description    = 'Android-first on-device streaming dictation'
  s.license        = { :type => 'MIT' }
  s.author         = 'Life Dashboard'
  s.homepage       = 'https://github.com/moonshine-ai/moonshine'
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = 'ios/**/*.{h,m,mm,swift,hpp,cpp}'
end
