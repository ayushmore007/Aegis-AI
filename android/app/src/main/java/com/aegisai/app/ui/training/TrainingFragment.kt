package com.aegisai.app.ui.training

import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.aegisai.app.databinding.FragmentTrainingBinding
import androidx.navigation.fragment.findNavController
import com.aegisai.app.R

class TrainingFragment : Fragment() {
    private var _binding: FragmentTrainingBinding? = null
    private val binding get() = _binding!!

    private val scenarios = listOf(
        Scenario(
            "Your bank account will be blocked today. Share your OTP immediately to verify.",
            true
        ),
        Scenario(
            "Hi, your package is out for delivery. Track at https://safe-post.example.com/track",
            false
        ),
        Scenario(
            "Congratulations! You won ₹10 lakh. Pay ₹499 processing fee to claim.",
            true
        ),
        Scenario(
            "Meeting moved to 3pm tomorrow. See you in the conference room.",
            false
        )
    )

    private var index = 0
    private var xp = 0

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentTrainingBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val sp = requireContext().getSharedPreferences("aegis_training", Context.MODE_PRIVATE)
        xp = sp.getInt("xp", 0)
        index = sp.getInt("idx", 0) % scenarios.size
        showScenario()
        updateXp()

        val prefs = com.aegisai.app.AegisApp.get(requireContext()).prefs
        val name = prefs.username
        binding.profileBtn.text = if (!name.isNullOrBlank()) name.take(2).uppercase() else "ME"
        binding.profileBtn.setOnClickListener {
            findNavController().navigate(R.id.action_training_to_profile)
        }
        com.aegisai.app.util.AnimUtil.fadeInUp(binding.profileBtn)

        binding.scamBtn.setOnClickListener { answer(true) }
        binding.safeBtn.setOnClickListener { answer(false) }
    }

    private fun showScenario() {
        val s = scenarios[index]
        binding.scenarioText.text = s.text
        binding.trainingFeedback.text = ""
    }

    private fun answer(userSaysScam: Boolean) {
        val s = scenarios[index]
        val correct = userSaysScam == s.isScam
        binding.trainingFeedback.text = if (correct) "Correct!" else "Incorrect — review the signs."
        binding.trainingFeedback.setTextColor(
            requireContext().getColor(if (correct) com.aegisai.app.R.color.safe_green else com.aegisai.app.R.color.scam_red)
        )
        if (correct) xp += 10
        index = (index + 1) % scenarios.size
        val sp = requireContext().getSharedPreferences("aegis_training", Context.MODE_PRIVATE)
        sp.edit().putInt("xp", xp).putInt("idx", index).apply()
        updateXp()
        lifecycleScope.launch {
            try {
                SessionHelper.syncHistoryWithCloud(requireContext())
            } catch (_: Exception) {}
        }
        binding.root.postDelayed({ showScenario() }, 1200)
    }

    private fun updateXp() {
        binding.xpText.text = "XP: $xp"
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    private data class Scenario(val text: String, val isScam: Boolean)
}
