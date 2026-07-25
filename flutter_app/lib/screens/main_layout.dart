import 'package:flutter/material.dart';
import 'package:lucide_icons/lucide_icons.dart';
import 'scan_screen.dart';
import 'email_screen.dart';
import 'vishing_screen.dart';
import 'training_screen.dart';
import 'profile_screen.dart';

class MainLayout extends StatefulWidget {
  const MainLayout({Key? key}) : super(key: key);

  @override
  State<MainLayout> createState() => _MainLayoutState();
}

class _MainLayoutState extends State<MainLayout> {
  int _selectedIndex = 0;

  final List<Widget> _screens = [
    const ScanScreen(),
    const EmailScreen(),
    const VishingScreen(),
    const TrainingScreen(),
    const ProfileScreen(),
  ];

  void _onItemTapped(int index) {
    setState(() {
      _selectedIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _screens[_selectedIndex],
      bottomNavigationBar: BottomNavigationBar(
        backgroundColor: const Color(0xFF0B0D12),
        type: BottomNavigationBarType.fixed,
        selectedItemColor: const Color(0xFF10B981),
        unselectedItemColor: Colors.grey,
        currentIndex: _selectedIndex,
        onTap: _onItemTapped,
        items: const [
          BottomNavigationBarItem(icon: Icon(LucideIcons.scan), label: 'Scan'),
          BottomNavigationBarItem(icon: Icon(LucideIcons.mail), label: 'Email'),
          BottomNavigationBarItem(icon: Icon(LucideIcons.shieldAlert), label: 'Vishing'),
          BottomNavigationBarItem(icon: Icon(LucideIcons.gamepad2), label: 'Training'),
          BottomNavigationBarItem(icon: Icon(LucideIcons.user), label: 'Profile'),
        ],
      ),
    );
  }
}
